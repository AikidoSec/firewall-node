import type { RequestHandler } from "express";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const context = contextFromRequest(req);

    return runWithContext(context, () => {
      return handler(req, res, next);
    });
  };
}
