import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { isLocalhostIP } from "../../helpers/isLocalhostIP";
import { tryParseURL } from "../../helpers/tryParseURL";

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
  const rateLimiting = getRateLimitingForContext(context, agent);

  if (!rateLimiting) {
    return { block: false };
  }

  const { config, route } = rateLimiting;

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
        config.windowSizeInMS,
        config.maxRequests
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
        config.windowSizeInMS,
        config.maxRequests
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

function getRateLimitingForContext(context: Context, agent: Agent) {
  if (!context.method) {
    return undefined;
  }

  if (context.route) {
    const rateLimiting = agent
      .getConfig()
      .getRateLimiting(context.method, context.route);

    if (rateLimiting) {
      return { config: rateLimiting, route: context.route };
    }
  }

  if (context.url) {
    const url = tryParseURL(context.url);
    if (url && url.pathname) {
      const rateLimiting = agent
        .getConfig()
        .getRateLimiting(context.method, url.pathname);

      if (rateLimiting) {
        return { config: rateLimiting, route: url.pathname };
      }
    }
  }

  return undefined;
}
