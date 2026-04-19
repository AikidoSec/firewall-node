import { Agent } from "../agent/Agent";
import { Endpoint } from "../agent/Config";
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
      endpoint: Endpoint;
      retryAfterMs: number | undefined;
    }
  | {
      block: true;
      trigger: "user";
      endpoint: Endpoint;
      retryAfterMs: number | undefined;
    }
  | {
      block: true;
      trigger: "group";
      endpoint: Endpoint;
      retryAfterMs: number | undefined;
    };

export function shouldRateLimitRequest(
  context: Readonly<Context>,
  agent: Agent
): Result {
  // Do not consume rate limit for the same request a second time
  // (Might happen if the user adds the middleware multiple times)
  if (context.consumedRateLimit) {
    return { block: false };
  }

  // We want to count the request only once
  updateContext(context, "consumedRateLimit", true);

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
  const isBypassedIP =
    context.remoteAddress &&
    agent.getConfig().isBypassedIP(context.remoteAddress);

  if (isFromLocalhostInProduction || isBypassedIP) {
    return { block: false };
  }

  if (
    context.user &&
    agent.getConfig().isUserExcludedFromRateLimiting(context.user.id)
  ) {
    return { block: false };
  }

  const { maxRequests, windowSizeInMS } = endpoint.rateLimiting;

  if (context.rateLimitGroup) {
    const key = `${endpoint.method}:${endpoint.route}:group:${context.rateLimitGroup}`;
    const allowed = agent
      .getRateLimiter()
      .isAllowed(key, windowSizeInMS, maxRequests);

    if (!allowed) {
      const retryAfterMs = agent
        .getRateLimiter()
        .getRetryAfterMs(key, windowSizeInMS);
      return { block: true, trigger: "group", endpoint, retryAfterMs };
    }

    // Do not check IP or User rate limit if rateLimitGroup is set
    return { block: false };
  }

  if (context.user) {
    const key = `${endpoint.method}:${endpoint.route}:user:${context.user.id}`;
    const allowed = agent
      .getRateLimiter()
      .isAllowed(key, windowSizeInMS, maxRequests);

    if (!allowed) {
      const retryAfterMs = agent
        .getRateLimiter()
        .getRetryAfterMs(key, windowSizeInMS);
      return { block: true, trigger: "user", endpoint, retryAfterMs };
    }

    // Do not check IP rate limit if user is set
    return { block: false };
  }

  if (context.remoteAddress) {
    const key = `${endpoint.method}:${endpoint.route}:ip:${context.remoteAddress}`;
    const allowed = agent
      .getRateLimiter()
      .isAllowed(key, windowSizeInMS, maxRequests);

    if (!allowed) {
      const retryAfterMs = agent
        .getRateLimiter()
        .getRetryAfterMs(key, windowSizeInMS);
      return { block: true, trigger: "ip", endpoint, retryAfterMs };
    }
  }

  return { block: false };
}
