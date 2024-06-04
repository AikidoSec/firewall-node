import type { Context as HonoContext } from "hono";
import { Context } from "../../agent/Context";
import { parse } from "../../helpers/parseCookies";

export async function contextFromRequest(c: HonoContext): Promise<Context> {
  const { req } = c;

  let route = undefined;
  if (req.routePath) {
    route = req.routePath;
  }

  const cookieHeader = req.header("cookie");

  return {
    method: c.req.method,
    remoteAddress: undefined, // TODO
    body: undefined, // TODO
    url: req.url,
    headers: req.header(),
    routeParams: req.param(),
    query: req.query(),
    /* c8 ignore next */
    cookies: cookieHeader ? parse(cookieHeader) : {},
    source: "hono",
    route: route,
  };
}
