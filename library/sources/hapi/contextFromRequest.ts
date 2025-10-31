import type { Request } from "@hapi/hapi";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { getRequestUrl } from "../../helpers/getRequestUrl";
import { getRawRequestPath } from "../../helpers/getRawRequestPath";

export function contextFromRequest(req: Request): Context {
  const partialUrl = req.url.toString();

  return {
    method: req.method.toUpperCase(),
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.info.remoteAddress,
    }),
    body: req.payload,
    url: req.raw?.req ? getRequestUrl(req.raw?.req) : partialUrl,
    urlPath: getRawRequestPath(partialUrl),
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.state || {},
    source: "hapi",
    route: buildRouteFromURL(partialUrl),
  };
}
