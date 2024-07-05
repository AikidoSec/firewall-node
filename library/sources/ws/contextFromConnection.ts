import type { WebSocket } from "ws";
import { Context } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse } from "../../helpers/parseCookies";
import type { IncomingMessage } from "http";
import { tryParseURLParams } from "../../helpers/tryParseURLParams";

export function contextFromConnection(req: IncomingMessage): Context {
  const queryObject: Record<string, string> = {};
  if (req.url) {
    const params = tryParseURLParams(req.url);
    for (const [key, value] of params.entries()) {
      queryObject[key] = value;
    }
  }

  const parsedBody: unknown = undefined;
  // Todo parse body?
  /*if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      // Ignore
    }
  }*/

  return {
    url: req.url,
    method: req.method,
    headers: req.headers,
    route: req.url ? buildRouteFromURL(req.url) : undefined,
    query: queryObject,
    source: `ws.connection`,
    routeParams: {},
    cookies: req.headers?.cookie ? parse(req.headers.cookie) : {},
    body: parsedBody,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
  };
}
