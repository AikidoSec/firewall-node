import type { Response } from "express";
import { listEvents as list } from "../zen/events.ts";
import type { ZenRequest } from "../types.ts";

export function listEvents(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }
  res.json(list(req.zenApp));
}
