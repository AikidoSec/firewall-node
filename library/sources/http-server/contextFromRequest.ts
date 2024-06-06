import type { IncomingMessage } from "http";
import { Context } from "../../agent/Context";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse } from "../../helpers/parseCookies";

export function contextFromRequest(
  req: IncomingMessage,
  body: string | undefined,
  module: string
): Context {
  let parsedURL: URL | undefined = undefined;
  if (req.url) {
    try {
      parsedURL = new URL(
        req.url.startsWith("/") ? `http://localhost${req.url}` : req.url
      );
    } catch (e) {
      // Ignore
    }
  }

  const queryObject: Record<string, string> = {};
  if (parsedURL) {
    for (const [key, value] of parsedURL.searchParams.entries()) {
      queryObject[key] = value;
    }
  }

  let parsedBody: unknown = undefined;
  if (body) {
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      // Ignore
    }
  }

  return {
    url: req.url,
    method: req.method,
    headers: req.headers,
    route: undefined,
    query: queryObject,
    source: `${module}.createServer`,
    routeParams: {},
    cookies: req.headers?.cookie ? parse(req.headers.cookie) : {},
    body: parsedBody,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
  };
}
