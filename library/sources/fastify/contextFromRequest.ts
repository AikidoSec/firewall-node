import type { FastifyRequest } from "fastify";
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
    // Todo types
    // @ts-ignore
    routeParams: req.params,
    // Todo types
    // @ts-ignore
    query: req.query,
    /* c8 ignore next */
    // Todo types
    // @ts-ignore
    cookies: req.cookies ? req.cookies : {},
    source: "express",
    route: buildRouteFromURL(req.url),
  };
}
