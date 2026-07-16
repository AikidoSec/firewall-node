import type { Response } from "express";
import { removeApp } from "../zen/apps.ts";
import { closeStreams } from "./stream.ts";
import type { ZenRequest } from "../types.ts";

export function deleteApp(req: ZenRequest, res: Response) {
  if (!req.zenApp) {
    throw new Error("App is missing");
  }

  removeApp(req.zenApp);
  closeStreams(req.zenApp.id);
  res.json({ ok: true });
}
