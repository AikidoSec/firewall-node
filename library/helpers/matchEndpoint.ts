import { Endpoint } from "../agent/Config";
import { Context } from "../agent/Context";
import { tryParseURLPath } from "./tryParseURLPath";

export type LimitedContext = Pick<Context, "url" | "method" | "route">;

export function matchEndpoint(
  context: LimitedContext,
  endpoints: Endpoint[]
): Endpoint[] {
  if (!context.method) {
    return [];
  }

  const possible = endpoints.filter((endpoint) => {
    if (endpoint.method === "*") {
      return true;
    }

    return endpoint.method === context.method;
  });

  const matches: Endpoint[] = [];
  const exact = possible.find((endpoint) => endpoint.route === context.route);

  if (exact) {
    matches.push(exact);
  }

  const wildcards = possible
    .filter((endpoint) => endpoint.route.includes("*"))
    .sort((a, b) => {
      // Sort endpoints based on the amount of * in the route
      return b.route.split("*").length - a.route.split("*").length;
    });

  if (context.url) {
    // req.url is relative, so we need to prepend a host to make it absolute
    // We just match the pathname, we don't use the host for matching
    const path = tryParseURLPath(context.url);

    if (path) {
      for (const wildcard of wildcards) {
        const regex = new RegExp(
          `^${wildcard.route.replace(/\*/g, "(.*)")}\/?$`,
          "i"
        );

        if (regex.test(path)) {
          matches.push(wildcard);
        }
      }
    }
  }

  return matches;
}
