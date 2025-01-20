import type { Context as HonoContext } from "hono";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse } from "../../helpers/parseCookies";
import { getRemoteAddress } from "./getRemoteAddress";

export async function contextFromRequest(c: HonoContext): Promise<Context> {
  const { req } = c;

  const cookieHeader = req.header("cookie");

  return {
    method: c.req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.header(),
      remoteAddress: getRemoteAddress(c),
    }),
    body: undefined, // Body is added in wrapRequestBodyParsing
    url: req.url,
    headers: req.header(),
    routeParams: req.param(),
    query: req.query(),
    /* c8 ignore next */
    cookies: cookieHeader ? parse(cookieHeader) : {},
    source: "hono",
    route: buildRouteFromURL(req.url),
  };
}
