import type { FastifyRequest } from "fastify";
import { Context } from "../../agent/Context";
import { getStableRouteAndRemoteAddress } from "../../helpers/getStableRouteAndRemoteAddress";

export function contextFromRequest(req: FastifyRequest): Context {
  const { route, remoteAddress } = getStableRouteAndRemoteAddress(req.raw);

  return {
    method: req.method,
    remoteAddress,
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
    route,
  };
}
