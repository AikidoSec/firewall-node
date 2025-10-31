import type { Request } from "express";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { getRawRequestPath } from "../../helpers/getRawRequestPath";
import { getRequestUrl } from "../../helpers/getRequestUrl";

export function contextFromRequest(req: Request): Context {
  return {
    method: req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
    body: req.body ? req.body : undefined,
    url: getRequestUrl(req),
    urlPath: getRawRequestPath(req.originalUrl),
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.cookies ? req.cookies : {},
    source: "express",
    route: buildRouteFromURL(req.originalUrl),
    subdomains: req.subdomains,
  };
}
