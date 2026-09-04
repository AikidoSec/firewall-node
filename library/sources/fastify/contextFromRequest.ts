import type { FastifyRequest } from "fastify";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { isTrustedProxyRequest } from "../../helpers/trustProxy";

export function contextFromRequest(req: FastifyRequest): Context {
  const rawRemoteAddress = req.socket?.remoteAddress;

  return {
    method: req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: rawRemoteAddress,
    }),
    isBehindTrustedProxy: isTrustedProxyRequest(rawRemoteAddress),
    body: req.body ? req.body : undefined,
    url: req.url,
    headers: req.headers,
    // @ts-expect-error not typed
    routeParams: req.params,
    // @ts-expect-error not typed
    query: req.query,
    /* c8 ignore next */
    // @ts-expect-error not typed
    cookies: req.cookies ? req.cookies : {},
    source: "fastify",
    route: buildRouteFromURL(req.url),
  };
}
