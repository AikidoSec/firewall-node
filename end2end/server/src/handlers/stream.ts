import type { Response } from "express";
import { getAppConfig, configEvents } from "../zen/config.ts";
import type { ZenRequest } from "../types.ts";

export function stream(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  const app = req.zenApp;

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
    configEvents.off(eventName, sendConfig);
    clearInterval(ping);
  });
}
