import type { Response } from "express";
import { getAppConfig } from "../zen/config.ts";
import type { ZenRequest } from "../types.ts";

export function realtimeConfig(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  const config = getAppConfig(req.zenApp);

  res.json({
    serviceId: req.zenApp.id,
    configUpdatedAt: config.configUpdatedAt,
  });
}
