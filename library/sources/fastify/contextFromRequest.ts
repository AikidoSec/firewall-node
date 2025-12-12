import type { FastifyRequest } from "fastify";
import { getRegisteredRouteParams } from "../../agent/addRouteParam";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";

export function contextFromRequest(req: FastifyRequest): Context {
  return {
    method: req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
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
    route: buildRouteFromURL(req.url, getRegisteredRouteParams()),
  };
}
