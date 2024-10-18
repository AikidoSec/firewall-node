import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { shouldRateLimitRequest } from "../ratelimiting/shouldRateLimitRequest";

export function shouldBlockRequest(): {
  block: boolean;
  type?: "rate-limit" | "blocked";
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

  if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
    return { block: true, type: "blocked", trigger: "user" };
  }

  const rateLimitResult = shouldRateLimitRequest(context, agent);
  if (rateLimitResult.block) {
    return {
      block: true,
      type: "rate-limit",
      trigger: rateLimitResult.trigger,
      ip: context.remoteAddress,
    };
  }

  return { block: false };
}
