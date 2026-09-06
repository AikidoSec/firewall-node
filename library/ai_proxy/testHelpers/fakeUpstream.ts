import { readFileSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import * as net from "node:net";
import { join } from "node:path";
import { createServer as createTlsServer, type TLSSocket } from "node:tls";

/**
 * A local CONNECT-only TLS server standing in for a real AI provider, so
 * tests can drive the real proxy binary without an API key or external
 * network traffic. Mirrors firewall-python's
 * aikido_zen/ai_proxy/tests/fake_upstream.py.
 */

const CERT_PATH = join(__dirname, "..", "testFixtures", "fakeUpstreamTls.pem");

export type CannedResponse = { body: string; contentType?: string };

export function sse(text: string): CannedResponse {
  return { body: text, contentType: "text/event-stream" };
}

export class FakeUpstream {
  port = 0;
  requests: { host: string; path: string; body: string }[] = [];
  responses: Record<string, [string, CannedResponse][]>;

  private tlsServer: ReturnType<typeof createTlsServer>;
  private connectProxy: Server;
  // A CONNECT tunnel hands the raw socket off outside the servers' own
  // connection tracking, so http.Server#closeAllConnections doesn't reach
  // them -- every socket here is tracked and destroyed by hand on stop().
  // Typed structurally: the "connect" event's clientSocket comes through as
  // a plain Duplex, not the more specific net.Socket.
  private sockets = new Set<{ destroy(): void; on(event: "close", cb: () => void): void }>();

  constructor(responses: Record<string, [string, CannedResponse][]> = {}) {
    this.responses = responses;
    const pem = readFileSync(CERT_PATH, "utf8");
    const cert = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)![0];
    const key = pem.match(
      /-----BEGIN (?:RSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA )?PRIVATE KEY-----/
    )![0];

    this.tlsServer = createTlsServer({ cert, key }, (socket) => {
      this.track(socket);
      this.handleTls(socket);
    });
    // A plain HTTP CONNECT proxy in front of the TLS server -- the real
    // proxy tunnels through this the same way it tunnels to a real provider.
    this.connectProxy = createHttpServer();
    this.connectProxy.on("connect", (_req, clientSocket, head) => {
      this.track(clientSocket);
      const upstreamSocket = net.connect(this.tlsPort, "127.0.0.1", () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        upstreamSocket.write(head);
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      });
      this.track(upstreamSocket);
    });
  }

  private track(socket: { destroy(): void; on(event: "close", cb: () => void): void }) {
    this.sockets.add(socket);
    socket.on("close", () => this.sockets.delete(socket));
  }

  private tlsPort = 0;

  async start() {
    await new Promise<void>((resolve) =>
      this.tlsServer.listen(0, "127.0.0.1", () => {
        this.tlsPort = (this.tlsServer.address() as net.AddressInfo).port;
        resolve();
      })
    );
    await new Promise<void>((resolve) =>
      this.connectProxy.listen(0, "127.0.0.1", () => {
        this.port = (this.connectProxy.address() as net.AddressInfo).port;
        resolve();
      })
    );
  }

  async stop() {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    await new Promise((resolve) => this.connectProxy.close(resolve));
    await new Promise((resolve) => this.tlsServer.close(resolve));
  }

  private handleTls(socket: TLSSocket) {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const head = buffer.slice(0, headerEnd);
      const lines = head.split("\r\n");
      const [, path] = lines[0].split(" ");
      const headers = new Map<string, string>();
      for (const line of lines.slice(1)) {
        const idx = line.indexOf(": ");
        if (idx > -1) {
          headers.set(line.slice(0, idx).toLowerCase(), line.slice(idx + 2));
        }
      }
      const host = headers.get("host") ?? "";
      const contentLength = Number(headers.get("content-length") ?? "0");
      const body = buffer.slice(headerEnd + 4, headerEnd + 4 + contentLength);
      if (body.length < contentLength) {
        return; // wait for the rest
      }

      this.requests.push({ host, path, body });

      const canned = this.match(host, path) ?? { body: '{"ok":true}', contentType: "application/json" };
      socket.write(
        `HTTP/1.1 200 OK\r\nContent-Type: ${canned.contentType ?? "application/json"}\r\n` +
          `Content-Length: ${Buffer.byteLength(canned.body)}\r\nConnection: close\r\n\r\n${canned.body}`
      );
      socket.end();
    });
  }

  private match(host: string, path: string): CannedResponse | undefined {
    for (const [responseHost, entries] of Object.entries(this.responses)) {
      if (!host.includes(responseHost)) {
        continue;
      }
      for (const [fragment, canned] of entries) {
        if (path.includes(fragment)) {
          return canned;
        }
      }
    }
    return undefined;
  }
}
