import { Endpoint } from "../agent/Config";
import { Context, getFramework, getRoute } from "../agent/Context";
import { tryParseURLPath } from "./tryParseURLPath";

export function matchEndpoints(context: Context, endpoints: Endpoint[]) {
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

  const route = getRoute(context);
  const framework = getFramework(context);
  const exact = possible.find((endpoint) => {
    // If it's a framework route, (e.g. /api/:version/login)
    // We will never have an exact match with the context URL
    if (!framework || !endpoint.framework) {
      return false;
    }

    if (endpoint.framework && framework) {
      return endpoint.framework === framework && endpoint.route === route;
    }

    return endpoint.route === route;
  });
  if (exact) {
    matches.push(exact);
  }

  if (context.url) {
    // Find matching wildcard routes
    // Use path from URL
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
