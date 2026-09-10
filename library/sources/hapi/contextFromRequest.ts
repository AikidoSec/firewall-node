import type { Request } from "@hapi/hapi";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { isTrustedProxyRequest } from "../../helpers/trustProxy";

export function contextFromRequest(req: Request): Context {
  const rawRemoteAddress = req.info.remoteAddress;

  return {
    method: req.method.toUpperCase(),
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: rawRemoteAddress,
    }),
    isBehindTrustedProxy: isTrustedProxyRequest(rawRemoteAddress),
    body: req.payload,
    url: req.url.toString(),
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.state || {},
    source: "hapi",
    route: buildRouteFromURL(req.url.toString()),
  };
}
