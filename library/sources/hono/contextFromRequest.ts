import type { Context as HonoContext } from "hono";
import { Context, getContext } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse } from "../../helpers/parseCookies";
import { getRemoteAddress } from "./getRemoteAddress";
import { getRequestUrl } from "../../helpers/getRequestUrl";
import { getRawNodeRequest } from "./getRawRequest";

export function contextFromRequest(c: HonoContext): Context {
  const { req } = c;

  const cookieHeader = req.header("cookie");
  const existingContext = getContext();

  const rawReq = getRawNodeRequest(c);

  return {
    method: c.req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.header(),
      remoteAddress: getRemoteAddress(c),
    }),
    // Pass the body from the existing context if it's already set, otherwise the body is set in wrapRequestBodyParsing
    body:
      existingContext && existingContext.source === "hono"
        ? existingContext.body
        : undefined,
    url: rawReq ? getRequestUrl(rawReq) : req.url,
    urlPath: req.path,
    headers: req.header(),
    routeParams: req.param(),
    query: req.query(),
    /* c8 ignore next */
    cookies: cookieHeader ? parse(cookieHeader) : {},
    source: "hono",
    route: buildRouteFromURL(req.url),
  };
}
