/* eslint-disable max-lines-per-function */
import type { Agent } from "../../agent/Agent";
import { contextFromRequest } from "./contextFromRequest";
import { getContext, runWithContext } from "../../agent/Context";
import type { Middleware, Context as KoaContext } from "koa";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import { escapeHTML } from "../../helpers/escapeHTML";

export function wrapMiddleware(
  origMiddleware: Middleware,
  agent: Agent
): Middleware {
  return function wrapped() {
    const applyOriginal = () => {
      return origMiddleware.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // @ts-expect-error We don't know the type of arguments
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };

    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);
    if (
      typeof args[0] !== "object" ||
      Array.isArray(args[0]) ||
      args[0] === null
    ) {
      return applyOriginal();
    }

    const ctx = args[0] as KoaContext;
    const context = contextFromRequest(ctx);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return applyOriginal();
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        ctx.type = "text/plain";
        ctx.body = "You are blocked by Aikido firewall.";
        ctx.status = 403;
        return;
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        ctx.type = "text/plain";
        ctx.body = message;
        ctx.status = 429;
        return;
      }

      return applyOriginal();
    });
  };
}
