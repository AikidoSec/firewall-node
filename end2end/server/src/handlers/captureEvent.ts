import type { Response } from "express";
import { getAppConfig } from "../zen/config.ts";
import { captureEvent as capture } from "../zen/events.ts";
import { setTimeout } from "node:timers/promises";
import { randomInt } from "node:crypto";
import type { ZenRequest } from "../types.ts";

export async function captureEvent(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  // For testing: allow simulating API failures and delays for attack events
  if (req.body.type === "detected_attack") {
    const config = getAppConfig(req.zenApp);

    if (typeof config.failureRate === "number" && config.failureRate > 0) {
      if (Math.random() < config.failureRate) {
        return req.socket.destroy();
      }
    }

    if (typeof config.timeout === "number" && config.timeout > 0) {
      const delay = randomInt(0, config.timeout);
      await setTimeout(delay);
    }
  }

  capture(req.body, req.zenApp);

  if (req.body.type === "detected_attack") {
    return res.json({
      success: true,
    });
  }

  return res.json(getAppConfig(req.zenApp));
}
