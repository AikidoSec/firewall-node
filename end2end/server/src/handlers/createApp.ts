import type { Response } from "express";
import { createApp as create, getByToken } from "../zen/apps.ts";
import { updateAppConfig } from "../zen/config.ts";
import type { ZenRequest } from "../types.ts";

export function createApp(req: ZenRequest, res: Response) {
  const token = create();

  // Support optional config parameters for testing
  if (req.body) {
    const app = getByToken(token);
    if (app) {
      const testConfig: Record<string, unknown> = {};

      if (typeof req.body.failureRate === "number") {
        testConfig.failureRate = req.body.failureRate;
      }

      if (typeof req.body.timeout === "number") {
        testConfig.timeout = req.body.timeout;
      }

      if (Object.keys(testConfig).length > 0) {
        updateAppConfig(app, testConfig);
      }
    }
  }

  res.json({
    token,
  });
}
