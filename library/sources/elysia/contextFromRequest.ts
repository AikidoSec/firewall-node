import type { Context as ElysiaContext } from "elysia";
import { getContext, type Context } from "../../agent/Context";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";

export function contextFromRequest(ctx: ElysiaContext): Context {
  const existingContext = getContext();

  return {
    method: ctx.request.method,
    remoteAddress:
      existingContext?.remoteAddress ||
      getIPAddressFromRequest({
        headers: ctx.headers,
        remoteAddress: undefined, // Not possible in Node.js with Elysia
      }),
    body: ctx.body,
    url: ctx.request.url,
    headers: ctx.headers,
    routeParams: ctx.params,
    query: ctx.query,
    cookies: convertCookies(ctx.cookie),
    source: "elysia",
    route: buildRouteFromURL(ctx.request.url),
  };
}

function convertCookies(
  cookies: ElysiaContext["cookie"]
): Record<string, string> {
  if (!cookies) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(cookies)
      .map(([k, v]) => [k, v.value])
      .filter(([_, v]) => typeof v === "string")
  );
}
