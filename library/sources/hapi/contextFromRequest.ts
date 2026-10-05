import type { Request } from "@hapi/hapi";
import { Context } from "../../agent/Context";
import { getStableRouteAndRemoteAddress } from "../../helpers/getStableRouteAndRemoteAddress";

export function contextFromRequest(req: Request): Context {
  const { route, remoteAddress } = getStableRouteAndRemoteAddress(req.raw.req);

  return {
    method: req.method.toUpperCase(),
    remoteAddress,
    body: req.payload,
    url: req.url.toString(),
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.state || {},
    source: "hapi",
    route,
  };
}
