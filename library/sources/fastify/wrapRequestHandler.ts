import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: (request: FastifyRequest, reply: FastifyReply) => unknown,
  agent: Agent
): unknown {
  return (request: FastifyRequest, reply: FastifyReply) => {
    const context = contextFromRequest(request);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return handler(request, reply);
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        return reply.status(403).send("You are blocked by Aikido firewall.");
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        return reply.status(429).send(message);
      }

      return handler(request, reply);
    });
  };
}
