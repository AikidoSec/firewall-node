import type { Request } from "express";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { getRawRequestPath } from "../../helpers/getRawRequestPath";

export function contextFromRequest(req: Request): Context {
  const url = req.protocol + "://" + req.get("host") + req.originalUrl;

  return {
    method: req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
    body: req.body ? req.body : undefined,
    url: url,
    urlPath: getRawRequestPath(url),
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.cookies ? req.cookies : {},
    source: "express",
    route: buildRouteFromURL(url),
    subdomains: req.subdomains,
  };
}
