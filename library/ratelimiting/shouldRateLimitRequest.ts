import { Agent } from "../agent/Agent";
import { Context, updateContext } from "../agent/Context";
import { isLocalhostIP } from "../helpers/isLocalhostIP";
import { getRateLimitedEndpoint } from "./getRateLimitedEndpoint";

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
export function shouldRateLimitRequest(
  context: Readonly<Context>,
  agent: Agent
): Result {
  const endpoint = getRateLimitedEndpoint(context, agent.getConfig());

  if (!endpoint) {
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

  if (isFromLocalhostInProduction || isAllowedIP) {
    return { block: false };
  }

  const { maxRequests, windowSizeInMS } = endpoint.rateLimiting;

  if (context.user) {
    // Do not consume rate limit for user a second time
    if (context.consumedRateLimitForUser) {
      return { block: false };
    }

    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${endpoint.method}:${endpoint.route}:user:${context.user.id}`,
        windowSizeInMS,
        maxRequests
      );

    if (context.remoteAddress && context.consumedRateLimitForIP) {
      agent
        .getRateLimiter()
        .decrement(
          `${endpoint.method}:${endpoint.route}:ip:${context.remoteAddress}`
        );
    }

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    updateContext(context, "consumedRateLimitForUser", true);

    if (!allowed) {
      return { block: true, trigger: "user" };
    }

    // Do not check IP rate limit if user is set
    return { block: false };
  }

  if (context.remoteAddress && !context.consumedRateLimitForIP) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${endpoint.method}:${endpoint.route}:ip:${context.remoteAddress}`,
        windowSizeInMS,
        maxRequests
      );

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    updateContext(context, "consumedRateLimitForIP", true);

    if (!allowed) {
      return { block: true, trigger: "ip" };
    }
  }

  return { block: false };
}
