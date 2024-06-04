import { Context } from "../agent/Context";
import { ServiceConfig } from "../agent/ServiceConfig";
import { tryParseURL } from "./tryParseURL";

export function matchEndpoint(context: Context, config: ServiceConfig) {
  if (!context.method) {
    return undefined;
  }

  const endpoints = config.getEndpoints();

  if (context.route) {
    const endpoint = endpoints.find(
      (endpoint) =>
        endpoint.method === context.method && endpoint.route === context.route
    );

    if (endpoint) {
      return { endpoint: endpoint, route: context.route };
    }
  }

  if (!context.url) {
    return undefined;
  }

  const url = tryParseURL(context.url);

  if (!url || !url.pathname) {
    return undefined;
  }

  const endpoint = endpoints.find(
    (endpoint) =>
      endpoint.method === context.method && endpoint.route === url.pathname
  );

  if (endpoint && endpoint.rateLimiting && endpoint.rateLimiting.enabled) {
    return { endpoint: endpoint, route: endpoint.route };
  }

  const wildcards = endpoints
    .filter((endpoint) => endpoint.method === "*")
    .sort((a, b) => {
      // Sort endpoints based on the amount of * in the route
      return b.route.split("*").length - a.route.split("*").length;
    });

  for (const wildcard of wildcards) {
    const regex = new RegExp(
      `^${wildcard.route.replace(/\*/g, "(.*)")}\/?$`,
      "i"
    );

    if (regex.test(url.pathname)) {
      return { endpoint: wildcard, route: wildcard.route };
    }
  }

  return undefined;
}
