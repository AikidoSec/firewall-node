import { Endpoint } from "../agent/Config";
import { Context } from "../agent/Context";
import { tryParseURLPath } from "./tryParseURLPath";

export type LimitedContext = Pick<Context, "url" | "method" | "route">;

export function matchEndpoints(context: LimitedContext, endpoints: Endpoint[]) {
  const matches: Endpoint[] = [];

  if (!context.method) {
    return matches;
  }

  const possible = endpoints.filter((endpoint) => {
    if (endpoint.method === "*") {
      return true;
    }

    return endpoint.method === context.method;
  });

  // Sort so that exact method matches come first before wildcard matches
  possible.sort((a, b) => {
    if (a.method === b.method) {
      return 0;
    }

    if (a.method === "*") {
      return 1;
    }

    return -1;
  });

  const exact = possible.find((endpoint) => endpoint.route === context.route);
  if (exact) {
    matches.push(exact);
  }

  if (context.url) {
    // req.url is relative, so we need to prepend a host to make it absolute
    // We just match the pathname, we don't use the host for matching
    const path = tryParseURLPath(context.url);
    const wildcards = possible
      .filter((endpoint) => endpoint.route.includes("*"))
      .sort((a, b) => {
        // Sort endpoints based on the amount of * in the route
        return b.route.split("*").length - a.route.split("*").length;
      });

    if (path) {
      for (const wildcard of wildcards) {
        const regex = new RegExp(
          `^${wildcard.route.replace(/\*/g, "(.*)")}/?$`,
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
