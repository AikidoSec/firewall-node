import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";

export function shouldRateLimitRequest(context: Context, agent: Agent) {
  const rateLimiting = getRateLimitingForContext(context, agent);

  if (!rateLimiting) {
    return false;
  }

  const { config, route } = rateLimiting;

  if (context.remoteAddress && !context.rateLimitedIP) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${route}:ip:${context.remoteAddress}`,
        config.windowSizeInMS,
        config.maxRequests
      );

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    context.rateLimitedIP = true;

    if (!allowed) {
      return true;
    }
  }

  if (context.user && !context.rateLimitedUser) {
    const allowed = agent
      .getRateLimiter()
      .isAllowed(
        `${context.method}:${route}:user:${context.user.id}`,
        config.windowSizeInMS,
        config.maxRequests
      );

    // This function is executed for every middleware and route handler
    // We want to count the request only once
    context.rateLimitedUser = true;

    if (!allowed) {
      return true;
    }
  }

  return false;
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
