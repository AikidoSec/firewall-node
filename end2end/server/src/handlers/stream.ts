import type { Response } from "express";
import { getAppConfig, configEvents } from "../zen/config.ts";
import type { ZenRequest } from "../types.ts";

const connections = new Map<number, Set<Response>>();

export function stream(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  const app = req.zenApp;

  if (!connections.has(app.id)) {
    connections.set(app.id, new Set());
  }
  connections.get(app.id)!.add(res);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  function sendConfig() {
    const config = getAppConfig(app);
    const data = { serviceId: app.id, configUpdatedAt: config.configUpdatedAt };
    res.write(`event: config-updated\ndata: ${JSON.stringify(data)}\n\n`);
  }

  sendConfig();

  const eventName = `config-updated:${app.id}`;
  configEvents.on(eventName, sendConfig);

  const ping = setInterval(() => {
    res.write(": ping\n\n");
  }, 30_000);

  req.on("close", () => {
    connections.get(app.id)?.delete(res);
    configEvents.off(eventName, sendConfig);
    clearInterval(ping);
  });
}

export function disconnectStreams(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  const appConnections = connections.get(req.zenApp.id);
  if (appConnections) {
    for (const conn of appConnections) {
      conn.end();
    }
    appConnections.clear();
  }

  res.json({ ok: true });
}
