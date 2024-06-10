import type { Handler, MiddlewareHandler } from "hono";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { contextFromRequest } from "./contextFromRequest";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";

export function wrapRequestHandler(
  handler: Handler | MiddlewareHandler,
  agent: Agent
): MiddlewareHandler {
  return async (c, next) => {
    const context = await contextFromRequest(c);

    if (context.route) {
      agent.onRouteExecute(c.req.method, context.route);
    }

    return await runWithContext(context, async () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return await handler(c, next);
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        return c.text("You are blocked by Aikido firewall.", 403);
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        return c.text(message, 429);
      }

      return await handler(c, next);
    });
  };
}
