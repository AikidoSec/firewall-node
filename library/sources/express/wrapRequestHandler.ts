import type { RequestHandler } from "express";
import { Agent } from "../../agent/Agent";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: RequestHandler,
  agent: Agent,
  path: string | undefined
): RequestHandler {
  return (req, res, next) => {
    const context = contextFromRequest(req, path);

    if (context.route) {
      agent.onRouteExecute(req.method, context.route);
    }

    return runWithContext(context, () => {
      return handler(req, res, next);
    });
  };
}
