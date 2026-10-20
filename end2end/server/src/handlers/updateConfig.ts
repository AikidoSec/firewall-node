import type { Response } from "express";
import { updateAppConfig } from "../zen/config.ts";
import type { ZenRequest } from "../types.ts";

export function updateConfig(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  // Insecure input validation - but this is only a mock server
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    !Object.keys(req.body).length
  ) {
    return res.status(400).json({
      message: "Request body is missing or invalid",
    });
  }
  res.json({ success: updateAppConfig(req.zenApp, req.body) });
}
