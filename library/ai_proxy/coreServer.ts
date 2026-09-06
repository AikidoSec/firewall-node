import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from "node:http";
import { AddressInfo } from "node:net";

export type AiProxyConfig = {
  aiEnabled: boolean;
  blockedAiTools: string[];
};

const EVENT_TYPES = ["ai-usage", "ai-tool-hits"] as const;

/**
 * Plays the role of Aikido's cloud from the AI proxy's point of view: serves
 * the fetchPermissions/fetchAiPermissions config endpoints it polls, and
 * collects the events it reports.
 *
 * Holds no cloud credentials and never talks to Aikido's cloud itself --
 * config comes from `getConfig()`, and every received event is handed to
 * `onEvent`, which reports it onward exactly like a detected_attack event.
 */
export class AiCoreServer {
  private server: Server;
  private port = 0;

  constructor(
    private readonly getConfig: () => AiProxyConfig,
    private readonly onEvent: (event: Record<string, unknown>) => void
  ) {
    this.server = createServer((req, res) => this.handle(req, res));
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, "127.0.0.1", () => {
        this.port = (this.server.address() as AddressInfo).port;
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
      // The proxy polls this server with keep-alive connections; close()
      // alone waits for those to end on their own, which they may never do
      // before the caller wants to shut down.
      this.server.closeAllConnections();
    });
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  private handle(req: IncomingMessage, res: ServerResponse) {
    const path = req.url ?? "";

    if (req.method === "GET" && path.includes("fetchAiPermissions")) {
      const config = this.getConfig();
      this.sendJson(res, 200, {
        blocked_ai_tools: config.blockedAiTools,
        // CEL rule findings are unwired for now (the proxy's rule engine
        // stays intact; we just never hand it any rules to evaluate).
        ai_rules: [],
      });
      return;
    }

    if (req.method === "GET" && path.includes("fetchPermissions")) {
      const config = this.getConfig();
      this.sendJson(res, 200, {
        // permission_group is a required field for the proxy to accept this
        // response at all; its content is unused.
        permission_group: { id: 1, name: "zen-node-agent" },
        ecosystems: {},
        custom_registries: [],
        feature_flags: { ai_features_enabled: config.aiEnabled },
      });
      return;
    }

    if (req.method === "POST") {
      const eventType = EVENT_TYPES.find((t) => path.endsWith(`/events/${t}`));
      this.readBody(req).then((raw) => {
        if (!eventType) {
          this.sendJson(res, 404, { ok: false });
          return;
        }
        try {
          const body = raw ? JSON.parse(raw) : {};
          this.onEvent({ ...body, type: eventType });
        } catch {
          // malformed body from the proxy; drop it, don't crash the server
        }
        this.sendJson(res, 200, { ok: true });
      });
      return;
    }

    this.sendJson(res, 404, { error: "not found" });
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  private sendJson(res: ServerResponse, status: number, body: unknown) {
    const data = JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(data);
  }
}
