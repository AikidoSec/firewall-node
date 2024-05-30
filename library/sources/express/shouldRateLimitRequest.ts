import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";

export function shouldRateLimitRequest(context: Context, agent: Agent) {
  if (!context.route || !context.method) {
    return false;
  }

  const rateLimiting = agent
    .getConfig()
    .getRateLimiting(context.method, context.route);

  if (!rateLimiting) {
    return false;
  }

  if (context.remoteAddress) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${context.route}:ip:${context.remoteAddress}`,
        rateLimiting.windowSizeInMS,
        rateLimiting.maxRequests
      );

    if (!allowed) {
      return true;
    }
  }

  if (context.user) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${context.route}:user:${context.user.id}`,
        rateLimiting.windowSizeInMS,
        rateLimiting.maxRequests
      );

    if (!allowed) {
      return true;
    }
  }

  return false;
}
