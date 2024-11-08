import { getInstance } from "../agent/AgentSingleton";
import { getContext, updateContext } from "../agent/Context";
import { shouldRateLimitRequest } from "../ratelimiting/shouldRateLimitRequest";

export function shouldBlockRequest(): {
  block: boolean;
  type?: "ratelimited" | "blocked";
  trigger?: "ip" | "user";
  ip?: string;
} {
  const context = getContext();
  if (!context) {
    return { block: false };
  }

  const agent = getInstance();
  if (!agent) {
    return { block: false };
  }

  updateContext(context, "executedMiddleware", true);
  agent.onMiddlewareExecuted();

  if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
    return { block: true, type: "blocked", trigger: "user" };
  }

  if (
    context.remoteAddress &&
    agent.getConfig().isIPAddressBlocked(context.remoteAddress)
  ) {
    return {
      block: true,
      type: "blocked",
      trigger: "ip",
      ip: context.remoteAddress,
    };
  }

  const rateLimitResult = shouldRateLimitRequest(context, agent);
  if (rateLimitResult.block) {
    return {
      block: true,
      type: "ratelimited",
      trigger: rateLimitResult.trigger,
      ip: context.remoteAddress,
    };
  }

  return { block: false };
}
