import { Endpoint } from "../agent/Config";
import { Context } from "../agent/Context";
import { ServiceConfig } from "../agent/ServiceConfig";

export function getRateLimitedEndpoint(
  context: Readonly<Context>,
  config: ServiceConfig
): Endpoint | undefined {
  const matches = config
    .getEndpoints(context)
    .filter((m) => m.rateLimiting && m.rateLimiting.enabled);

  if (matches.length === 0) {
    return undefined;
  }

  matches.sort((a, b) => {
    if (a.rateLimiting.windowSizeInMS === b.rateLimiting.windowSizeInMS) {
      return a.rateLimiting.maxRequests - b.rateLimiting.maxRequests;
    }

    return a.rateLimiting.windowSizeInMS - b.rateLimiting.windowSizeInMS;
  });

  return matches[0];
}
