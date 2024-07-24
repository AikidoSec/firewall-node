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

// eslint-disable-next-line max-lines-per-function
export function shouldRateLimitRequest(context: Context, agent: Agent): Result {
  const match = agent.getConfig().getEndpoint(context);

  if (!match) {
    return { block: false };
  }

  const { endpoint, route } = match;

  if (!endpoint.rateLimiting) {
    return { block: false };
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Allow requests from localhost in development to be rate limited
  // In production, we don't want to rate limit localhost
  const isFromLocalhostInProduction =
    context.remoteAddress &&
    isLocalhostIP(context.remoteAddress) &&
    isProduction;

  // Allow requests from allowed IPs, e.g. never rate limit office IPs
  const isAllowedIP =
    context.remoteAddress &&
    agent.getConfig().isAllowedIP(context.remoteAddress);

  const { maxRequests, windowSizeInMS } = endpoint.rateLimiting;

  if (
    context.remoteAddress &&
    !context.consumedRateLimitForIP &&
    !isFromLocalhostInProduction &&
    !isAllowedIP
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
