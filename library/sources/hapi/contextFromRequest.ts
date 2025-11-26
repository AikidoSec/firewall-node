import type { Request } from "@hapi/hapi";
import { getRegisteredRouteParams } from "../../agent/addRouteParam";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";

export function contextFromRequest(req: Request): Context {
  return {
    method: req.method.toUpperCase(),
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.info.remoteAddress,
    }),
    body: req.payload,
    url: req.url.toString(),
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.state || {},
    source: "hapi",
    route: buildRouteFromURL(req.url.toString(), getRegisteredRouteParams()),
  };
}
