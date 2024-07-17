import { Endpoint } from "../agent/Config";
import { Context } from "../agent/Context";
import { tryParseURLPath } from "./tryParseURLPath";

export type LimitedContext = Pick<Context, "url" | "method" | "route">;

export type Matcher = (endpoint: Endpoint) => boolean;

export function matchEndpoint(
  context: LimitedContext,
  endpoints: Endpoint[],
  match: Matcher
) {
  if (!context.method) {
    return undefined;
  }

  const possible = endpoints.filter((endpoint) => {
    if (endpoint.method === "*") {
      return true;
    }

    return endpoint.method === context.method;
  });

  const endpoint = possible.find(
    (endpoint) => endpoint.route === context.route && match(endpoint)
  );

  if (endpoint) {
    return { endpoint: endpoint, route: endpoint.route };
  }

  if (!context.url) {
    return undefined;
  }

  // req.url is relative, so we need to prepend a host to make it absolute
  // We just match the pathname, we don't use the host for matching
  const path = tryParseURLPath(context.url);

  if (!path) {
    return undefined;
  }

  const wildcards = possible
    .filter((endpoint) => endpoint.route.includes("*"))
    .sort((a, b) => {
      // Sort endpoints based on the amount of * in the route
      return b.route.split("*").length - a.route.split("*").length;
    });

  for (const wildcard of wildcards) {
    const regex = new RegExp(
      `^${wildcard.route.replace(/\*/g, "(.*)")}\/?$`,
      "i"
    );

    if (regex.test(path) && match(wildcard)) {
      return { endpoint: wildcard, route: wildcard.route };
    }
  }

  return undefined;
}
