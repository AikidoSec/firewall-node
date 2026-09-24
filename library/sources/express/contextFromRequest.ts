import type { Request } from "express";
import { Context } from "../../agent/Context";
import { getStableRouteAndRemoteAddress } from "../../helpers/getStableRouteAndRemoteAddress";

export function contextFromRequest(req: Request): Context {
  const { route, remoteAddress } = getStableRouteAndRemoteAddress(req);
  const url = req.protocol + "://" + req.get("host") + req.originalUrl;

  return {
    method: req.method,
    remoteAddress,
    body: req.body ? req.body : undefined,
    url: url,
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.cookies ? req.cookies : {},
    source: "express",
    route,
    subdomains: req.subdomains,
  };
}
