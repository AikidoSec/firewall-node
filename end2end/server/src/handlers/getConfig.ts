import type { Response } from "express";
import { getAppConfig } from "../zen/config.ts";
import type { ZenRequest } from "../types.ts";

export function getConfig(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  const config = getAppConfig(req.zenApp);
  delete config.failureRate;
  delete config.timeout;
  res.json(config);
}
