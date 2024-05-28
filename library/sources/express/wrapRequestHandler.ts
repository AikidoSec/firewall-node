import type { RequestHandler } from "express";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
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
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (
        context &&
        context.user &&
        agent.getConfig().isUserBlocked(context.user.id)
      ) {
        return res.status(403).send("You are blocked by Aikido runtime.");
      }

      if (context && context.route) {
        const rateLimiting = agent
          .getConfig()
          .getRateLimiting(req.method, context.route);

        if (rateLimiting) {
          return res
            .status(429)
            .send("You are being rate limited by Aikido runtime protection.");
        }
      }

      return handler(req, res, next);
    });
  };
}
