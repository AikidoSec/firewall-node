import type { IncomingMessage } from "http";
import { Context } from "../../agent/Context";
import { parse } from "../../helpers/parseCookies";

export function contextFromRequest(
  req: IncomingMessage,
  rawBody: string | undefined,
  module: string
): Context {
  let parsedURL: URL | undefined = undefined;
  if (req.url) {
    parsedURL = new URL(
      req.url.startsWith("/") ? `http://localhost${req.url}` : req.url
    );
  }

  const queryObject: Record<string, string> = {};
  if (parsedURL) {
    for (const [key, value] of parsedURL.searchParams.entries()) {
      queryObject[key] = value;
    }
  }

  let body: string | undefined = undefined;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
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
    body: body,
    remoteAddress: undefined,
  };
}
