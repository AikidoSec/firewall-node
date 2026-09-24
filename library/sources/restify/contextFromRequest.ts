import { IncomingMessage } from "http";
import { Context } from "../../agent/Context";
import { getStableRouteAndRemoteAddress } from "../../helpers/getStableRouteAndRemoteAddress";
import { isPlainObject } from "../../helpers/isPlainObject";
import { parse } from "../../helpers/parseCookies";

// See https://github.com/restify/node-restify/blob/master/lib/request.js
export type RestifyRequest = IncomingMessage & {
  href: () => string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
};

export function contextFromRequest(req: RestifyRequest): Context {
  const { route, remoteAddress } = getStableRouteAndRemoteAddress(req);

  return {
    method: req.method,
    remoteAddress,
    body: req.body ? req.body : undefined,
    url: req.href(),
    headers: req.headers || {},
    routeParams: req.params || {},
    query: isPlainObject(req.query) ? req.query : {},
    cookies: req.headers?.cookie ? parse(req.headers.cookie) : {},
    source: "restify",
    route,
  };
}
