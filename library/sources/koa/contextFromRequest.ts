import type { Context as KoaContext } from "koa";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse as parseCookies } from "../../helpers/parseCookies";

export function contextFromRequest(ctx: KoaContext): Context {
  const cookieHeader = ctx.req.headers?.cookie;

  return {
    method: ctx.request.method,
    remoteAddress: getIPAddressFromRequest({
      headers: ctx.request.headers,
      remoteAddress: ctx.request.socket?.remoteAddress,
    }),
    // @ts-expect-error Only available if a body parser is used
    body: ctx.request.body ? req.body : undefined,
    url: ctx.request.href,
    headers: ctx.request.headers,
    // Only available if e.g. koa-router is used
    routeParams: ctx.params ? ctx.params : {},
    query: ctx.request.query,
    cookies: cookieHeader ? parseCookies(cookieHeader) : {},
    source: "koa",
    route: buildRouteFromURL(ctx.request.href),
    subdomains: ctx.request.subdomains,
  };
}
