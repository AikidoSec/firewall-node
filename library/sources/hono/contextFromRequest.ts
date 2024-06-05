import type { Context as HonoContext } from "hono";
import { Context } from "../../agent/Context";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { isJsonContentType } from "../../helpers/isJsonContentType";
import { parse } from "../../helpers/parseCookies";

export async function contextFromRequest(c: HonoContext): Promise<Context> {
  const { req } = c;

  let route = undefined;
  if (req.routePath) {
    route = req.routePath;
  }

  let body = undefined;
  const contentType = req.header("content-type");
  if (contentType) {
    if (isJsonContentType(contentType)) {
      body = await req.json();
    } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
      body = await req.parseBody();
    }
  }

  const cookieHeader = req.header("cookie");

  return {
    method: c.req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.header(),
      remoteAddress: c.env.remoteAddress,
    }),
    body: body,
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
