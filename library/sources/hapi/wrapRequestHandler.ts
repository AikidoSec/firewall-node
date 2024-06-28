import type { ReqRefDefaults, Lifecycle } from "@hapi/hapi";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { contextFromRequest } from "./contextFromRequest";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";

export function wrapRequestHandler(
  handler: Lifecycle.Method<ReqRefDefaults>,
  agent: Agent
): Lifecycle.Method<ReqRefDefaults> {
  return async (request, h) => {
    const context = contextFromRequest(request);

    return await runWithContext(context, async () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return handler.apply(
          // @ts-expect-error We don't now the type of this
          this,
          [request, h]
        );
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        return h.response("You are blocked by Aikido firewall.").code(403);
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        return h.response(message).code(429);
      }

      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        [request, h]
      );
    });
  };
}
