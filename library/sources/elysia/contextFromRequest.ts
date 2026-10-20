import type { Context as ElysiaContext } from "elysia";
import type { Context } from "../../agent/Context";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";

export function contextFromRequest(ctx: ElysiaContext): Context {
  // On Node.js, Elysia uses the srvx library under the hood. srvx adds an `ip`
  // field to the request that holds the client's address.
  // https://github.com/h3js/srvx/blob/main/src/adapters/_node/request.ts#L41-L43
  const ip = (ctx.request as { ip?: unknown }).ip;

  return {
    method: ctx.request.method,
    remoteAddress: getIPAddressFromRequest({
      headers: ctx.headers,
      remoteAddress: typeof ip === "string" ? ip : undefined,
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
