import { Agent } from "../agent/Agent";
import { Context } from "../agent/Context";
import { isLocalhostIP } from "../helpers/isLocalhostIP";

type Result =
  | {
      block: false;
    }
  | {
      block: true;
      trigger: "ip";
    }
  | {
      block: true;
      trigger: "user";
    };

export function shouldRateLimitRequest(context: Context, agent: Agent): Result {
  const match = agent.getConfig().getEndpoint(context);

  if (!match) {
    return { block: false };
  }

  const { endpoint, route } = match;

  if (!endpoint.rateLimiting || !endpoint.rateLimiting.enabled) {
    return { block: false };
  }

  const { maxRequests, windowSizeInMS } = endpoint.rateLimiting;

  if (
    context.remoteAddress &&
    !context.consumedRateLimitForIP &&
    !isLocalhostIP(context.remoteAddress) &&
    !agent.getConfig().isAllowedIP(context.remoteAddress)
  ) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${route}:ip:${context.remoteAddress}`,
        windowSizeInMS,
        maxRequests
      );

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    context.consumedRateLimitForIP = true;

    if (!allowed) {
      return { block: true, trigger: "ip" };
    }
  }

  if (context.user && !context.consumedRateLimitForUser) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${route}:user:${context.user.id}`,
        windowSizeInMS,
        maxRequests
      );

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    context.consumedRateLimitForUser = true;

    if (!allowed) {
      return { block: true, trigger: "user" };
    }
  }

  return { block: false };
}
