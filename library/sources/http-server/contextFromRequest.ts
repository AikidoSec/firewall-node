import type { IncomingMessage } from "http";
import { Context } from "../../agent/Context";
import { getStableRouteAndRemoteAddress } from "../../helpers/getStableRouteAndRemoteAddress";
import { parse } from "../../helpers/parseCookies";
import { tryParseURLParams } from "../../helpers/tryParseURLParams";

export function contextFromRequest(
  req: IncomingMessage,
  body: unknown,
  module: string
): Context {
  const { route, remoteAddress } = getStableRouteAndRemoteAddress(req);
  const queryObject: Record<string, string> = {};
  if (req.url) {
    const params = tryParseURLParams(req.url);
    for (const [key, value] of params.entries()) {
      queryObject[key] = value;
    }
  }

  return {
    url: req.url,
    method: req.method,
    headers: req.headers,
    route,
    query: queryObject,
    source: `${module}.createServer`,
    routeParams: {},
    cookies: req.headers?.cookie ? parse(req.headers.cookie) : {},
    body: body ? body : undefined,
    remoteAddress,
  };
}
