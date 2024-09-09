import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapHookHandler(
  origHandler: Function,
  agent: Agent,
  hookName: string
): unknown {
  return function wrap() {
    // Execute the original handler
    const applyOriginal = () => {
      return origHandler.apply(
        // @ts-expect-error We don't know the type of `this`
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };

    const args = Array.from(arguments);
    if (args.length < 2 || typeof args[0] !== "object") {
      return applyOriginal();
    }

    const context = contextFromRequest(args[0] as FastifyRequest);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return applyOriginal();
      }

      // Check if user is blocked or rate limited in onRequest hook, because you can use
      // onRequest hook to handle requests before they are rate limited or without any route
      if (hookName !== "onRequest") {
        return applyOriginal();
      }

      const reply = args[1] as FastifyReply;
      // Check to be sure
      if (typeof reply !== "object" || typeof reply.status !== "function") {
        return applyOriginal();
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        if (!reply.raw.headersSent) {
          reply.status(403).send("You are blocked by Aikido firewall.");
          return applyOriginal();
        }
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }
        if (!reply.raw.headersSent) {
          reply.status(429).send(message);
          return applyOriginal();
        }
      }

      return applyOriginal();
    });
  };
}
