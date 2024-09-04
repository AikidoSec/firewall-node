import type { Context as HonoContext } from "hono";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { isJsonContentType } from "../../helpers/isJsonContentType";
import { parse } from "../../helpers/parseCookies";

export async function contextFromRequest(c: HonoContext): Promise<Context> {
  const { req } = c;

  let body = undefined;
  const contentType = req.header("content-type");
  if (contentType) {
    if (isJsonContentType(contentType)) {
      try {
        body = await req.json();
      } catch {
        // Ignore
      }
    } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
      try {
        body = await req.parseBody();
      } catch {
        // Ignore
      }
    } else if (
      contentType.includes("text/plain") ||
      contentType.includes("xml")
    ) {
      try {
        body = await req.text();
      } catch {
        // Ignore
      }
    }
  }

  const cookieHeader = req.header("cookie");

  return {
    method: c.req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.header(),
      remoteAddress: c.env?.remoteAddress,
    }),
    body: body,
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
