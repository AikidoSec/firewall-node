import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { tryParseURL } from "../../helpers/tryParseURL";

export function shouldRateLimitRequest(context: Context, agent: Agent) {
  const rateLimiting = getRateLimitingForContext(context, agent);

  if (!rateLimiting) {
    return false;
  }

  if (context.remoteAddress && !context.rateLimitedIP) {
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

    context.rateLimitedIP = true;
  }

  if (context.user && !context.rateLimitedUser) {
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

    context.rateLimitedUser = true;
  }

  return false;
}

function getRateLimitingForContext(context: Context, agent: Agent) {
  if (!context.method) {
    return undefined;
  }

  if (context.url) {
    const url = tryParseURL(context.url);
    if (url && url.pathname) {
      const rateLimiting = agent
        .getConfig()
        .getRateLimiting(context.method, url.pathname);

      if (rateLimiting) {
        return rateLimiting;
      }
    }
  }

  if (context.route) {
    const rateLimiting = agent
      .getConfig()
      .getRateLimiting(context.method, context.route);

    if (rateLimiting) {
      return rateLimiting;
    }
  }

  return undefined;
}
