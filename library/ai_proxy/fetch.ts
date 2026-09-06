import { readFileSync } from "node:fs";
import { Agent as HttpsAgent, request as httpsRequest, type RequestOptions } from "node:https";
import { connect as netConnect } from "node:net";
import { Duplex, Readable } from "node:stream";
import { connect as tlsConnect } from "node:tls";
import { readRuntimeInfo } from "./runtime";

/**
 * A fetch-compatible function that resolves the local AI proxy lazily, on
 * the first request, rather than at SDK-client-construction time.
 *
 * This matters because `new OpenAI()` / `new Anthropic()` are very often
 * constructed at import time -- before the AI proxy has had a chance to
 * start and publish its runtime file. Falls back to a direct (unproxied)
 * request whenever the proxy isn't up, so a dead or slow proxy never breaks
 * a customer's LLM call.
 *
 * Built on node:http(s)/net/tls directly rather than a proxying library
 * (e.g. undici's ProxyAgent) -- `library/` has a zero-runtime-dependency
 * invariant, and a hand-rolled CONNECT tunnel + custom `https.Agent` is the
 * only way to keep that while still routing through a local HTTP(S) proxy.
 * `Response`/`Headers` below are Node's own globals (backed internally by
 * Node's vendored undici), not an import of the `undici` package.
 */

class ZenProxyAgent extends HttpsAgent {
  constructor(
    private readonly proxyPort: number,
    private readonly ca: string
  ) {
    super({ keepAlive: true });
  }

  override createConnection(
    options: RequestOptions,
    callback?: (err: Error | null, stream: Duplex) => void
  ): undefined {
    const targetHost = options.host ?? "";
    const targetPort = options.port ?? 443;
    const socket = netConnect({ host: "127.0.0.1", port: this.proxyPort });

    const fail = (err: Error) => callback?.(err, undefined as unknown as Duplex);
    socket.once("error", fail);
    socket.write(
      `CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`
    );

    let buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const end = buffer.indexOf("\r\n\r\n");
      if (end === -1) {
        return;
      }
      socket.removeListener("data", onData);
      socket.removeListener("error", fail);

      const statusLine = buffer.subarray(0, buffer.indexOf("\r\n")).toString("latin1");
      if (!/^HTTP\/1\.[01] 200/.test(statusLine)) {
        socket.destroy();
        fail(new Error(`AI proxy CONNECT to ${targetHost}:${targetPort} failed: ${statusLine}`));
        return;
      }

      // Force HTTP/1.1: our own response parsing below can't speak h2.
      const tlsSocket = tlsConnect({
        socket,
        host: targetHost,
        servername: targetHost,
        ca: this.ca,
        rejectUnauthorized: true,
        ALPNProtocols: ["http/1.1"],
      });
      const rest = buffer.subarray(end + 4);
      if (rest.length > 0) {
        tlsSocket.unshift(rest);
      }
      tlsSocket.once("secureConnect", () => callback?.(null, tlsSocket));
      tlsSocket.once("error", fail);
    };
    socket.on("data", onData);
  }
}

type CacheEntry = { key: string; agent: ZenProxyAgent };

let cache: CacheEntry | undefined;

function agentFor(token: string): ZenProxyAgent | undefined {
  const info = readRuntimeInfo(token);
  if (!info) {
    return undefined;
  }

  const key = `${info.proxyPort}|${info.caPath}`;
  if (cache?.key !== key) {
    let ca: string;
    try {
      ca = readFileSync(info.caPath, "utf8");
    } catch {
      return undefined;
    }
    cache = { key, agent: new ZenProxyAgent(info.proxyPort, ca) };
  }
  return cache.agent;
}

export function resetFetchCache() {
  cache = undefined;
}

function headersToObject(init?: RequestInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!init?.headers) {
    return result;
  }
  new Headers(init.headers).forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function requestViaAgent(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  agent: ZenProxyAgent
): Promise<Response> {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  );
  const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");

  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        agent,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        headers: headersToObject(init),
      },
      (res) => {
        resolve(
          new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers as Record<string, string>,
          })
        );
      }
    );
    req.once("error", reject);

    const body = init?.body;
    if (body == null) {
      req.end();
    } else if (typeof body === "string" || Buffer.isBuffer(body) || body instanceof Uint8Array) {
      req.end(body);
    } else {
      Readable.fromWeb(body as never).pipe(req);
    }
  });
}

/** A fetch function pinned to the AI proxy for this token, fail-open. */
export function createZenFetch(
  token: string
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async function zenFetch(input, init) {
    const agent = agentFor(token);
    if (agent) {
      try {
        return await requestViaAgent(input, init, agent);
      } catch {
        // proxied call failed; fall open to a direct request below
      }
    }
    return fetch(input as string, init as object);
  };
}
