import { Endpoint } from "../agent/Config";
import { Context } from "../agent/Context";
import { tryParseURL } from "./tryParseURL";

export type LimitedContext = Pick<Context, "url" | "method" | "route">;

export function matchEndpoint(context: LimitedContext, endpoints: Endpoint[]) {
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
    (endpoint) => endpoint.route === context.route
  );

  if (endpoint) {
    return { endpoint: endpoint, route: endpoint.route };
  }

  if (!context.url) {
    return undefined;
  }

  const url = tryParseURL(
    context.url.startsWith("/") ? `http://localhost${context.url}` : context.url
  );

  if (!url) {
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

    if (regex.test(url.pathname)) {
      return { endpoint: wildcard, route: wildcard.route };
    }
  }

  return undefined;
}
