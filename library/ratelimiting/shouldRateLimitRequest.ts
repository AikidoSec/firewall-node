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
    }
  | {
      block: true;
      trigger: "group";
    };

// eslint-disable-next-line max-lines-per-function
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

  const { maxRequests, windowSizeInMS } = endpoint.rateLimiting;

  if (context.rateLimitGroup) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${endpoint.method}:${endpoint.route}:group:${context.rateLimitGroup}`,
        windowSizeInMS,
        maxRequests
      );

    if (!allowed) {
      return { block: true, trigger: "group" };
    }

    // Do not check IP rate limit if user is set
    return { block: false };
  }

  if (context.user) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${endpoint.method}:${endpoint.route}:user:${context.user.id}`,
        windowSizeInMS,
        maxRequests
      );

    if (!allowed) {
      return { block: true, trigger: "user" };
    }

    // Do not check IP rate limit if user is set
    return { block: false };
  }

  if (context.remoteAddress) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${endpoint.method}:${endpoint.route}:ip:${context.remoteAddress}`,
        windowSizeInMS,
        maxRequests
      );

    if (!allowed) {
      return { block: true, trigger: "ip" };
    }
  }

  return { block: false };
}
