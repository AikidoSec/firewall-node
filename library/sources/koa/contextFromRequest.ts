import type { Context as KoaContext } from "koa";
import { Context } from "../../agent/Context";
import { getStableRouteAndRemoteAddress } from "../../helpers/getStableRouteAndRemoteAddress";
import { parse as parseCookies } from "../../helpers/parseCookies";

export function contextFromRequest(ctx: KoaContext): Context {
  const { route, remoteAddress } = getStableRouteAndRemoteAddress(ctx.req);

  return {
    method: ctx.request.method,
    remoteAddress,
    // Body is not available by default in Koa, only if a body parser is used
    body: (ctx.request as any).body ? (ctx.request as any).body : undefined,
    url: ctx.request.href,
    headers: ctx.request.headers,
    // Only available if e.g. koa-router is used
    routeParams: ctx.params ? ctx.params : {},
    query: ctx.request.query,
    cookies: ctx.req.headers.cookie ? parseCookies(ctx.req.headers.cookie) : {},
    source: "koa",
    route,
    subdomains: ctx.request.subdomains,
  };
}
