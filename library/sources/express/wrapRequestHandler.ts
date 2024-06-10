import type { RequestHandler } from "express";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { contextFromRequest } from "./contextFromRequest";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";

export function wrapRequestHandler(
  handler: RequestHandler,
  agent: Agent
): RequestHandler {
  return (req, res, next) => {
    const context = contextFromRequest(req);

    if (context.route) {
      agent.onRouteExecute(req.method, context.route);
    }

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return handler(req, res, next);
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        return res.status(403).send("You are blocked by Aikido firewall.");
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        return res.status(429).send(message);
      }

      return handler(req, res, next);
    });
  };
}
