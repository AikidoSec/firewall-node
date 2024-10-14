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

  const exact = matches.find((m) => m.route === context.route);

  if (exact) {
    return exact;
  }

  matches.sort((a, b) => {
    const aRate = a.rateLimiting.maxRequests / a.rateLimiting.windowSizeInMS;
    const bRate = b.rateLimiting.maxRequests / b.rateLimiting.windowSizeInMS;

    return aRate - bRate;
  });

  return matches[0];
}
