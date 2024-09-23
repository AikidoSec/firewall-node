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

  if (context.user && !context.consumedRateLimitForUser) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${endpoint.method}:${endpoint.route}:user:${context.user.id}`,
        windowSizeInMS,
        maxRequests
      );

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    updateContext(context, "consumedRateLimitForUser", true);

    if (!allowed) {
      return { block: true, trigger: "user" };
    }
  }

  return { block: false };
}
