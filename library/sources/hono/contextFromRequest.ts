import type { Context as HonoContext } from "hono";
import { Context, getContext } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse } from "../../helpers/parseCookies";
import { getRemoteAddress } from "./getRemoteAddress";

export function contextFromRequest(c: HonoContext): Context {
  const { req } = c;

  const cookieHeader = req.header("cookie");
  const existingContext = getContext();

  return {
    method: c.req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.header(),
      remoteAddress: getRemoteAddress(c),
    }),
    // Pass body and files from the existing context if already set,
    // otherwise they are populated in wrapRequestBodyParsing after parseBody() is called.
    body:
      existingContext && existingContext.source === "hono"
        ? existingContext.body
        : undefined,
    files:
      existingContext && existingContext.source === "hono"
        ? existingContext.files
        : undefined,
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
