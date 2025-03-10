import type { Request } from "express";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";

export function contextFromRequest(req: Request, middleware: boolean): Context {
  const url = req.protocol + "://" + req.get("host") + req.originalUrl;

  let route: Context["route"];
  if (!middleware && req.route?.path) {
    route = {
      path: req.route.path,
      framework: "express",
    };
  } else {
    route = buildRouteFromURL(url);
  }

  return {
    method: req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
    body: req.body ? req.body : undefined,
    url: url,
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.cookies ? req.cookies : {},
    source: "express",
    route: route,
    subdomains: req.subdomains,
  };
}
