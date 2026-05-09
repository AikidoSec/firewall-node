import type { Response, NextFunction } from "express";
import { getByToken } from "../zen/apps.ts";
import type { ZenRequest } from "../types.ts";

export function checkToken(req: ZenRequest, res: Response, next: NextFunction) {
  const token = req.headers["authorization"] as string | undefined;

  if (!token) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  const app = getByToken(token);
  if (!app) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }

  req.zenApp = app;

  next();
}
