import { Endpoint } from "../agent/Config";
import { Context } from "../agent/Context";
import { tryParseURL } from "./tryParseURL";

type LimitedContext = Pick<Context, "url" | "method" | "route">;

export function matchEndpoint(context: LimitedContext, endpoints: Endpoint[]) {
  if (!context.method) {
    return undefined;
  }

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

  if (endpoint) {
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
