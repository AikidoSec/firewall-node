import { Context } from "../../../agent/Context";
import { buildRouteFromURL } from "../../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../../helpers/getIPAddressFromRequest";
import { getRawRequestPath } from "../../../helpers/getRawRequestPath";
import { getRequestUrlFromStream } from "../../../helpers/getRequestUrlFromStream";
import { parse } from "../../../helpers/parseCookies";
import { tryParseURLParams } from "../../../helpers/tryParseURLParams";
import { ServerHttp2Stream, IncomingHttpHeaders } from "http2";

/**
 * Extracts required information from the http2 stream and headers to create a context object.
 */
export function contextFromStream(
  stream: ServerHttp2Stream,
  headers: IncomingHttpHeaders,
  module: string
): Context {
  const path = headers[":path"];

  const queryObject: Record<string, string> = {};
  if (path) {
    const params = tryParseURLParams(path);
    for (const [key, value] of params.entries()) {
      queryObject[key] = value;
    }
  }

  return {
    url: getRequestUrlFromStream(headers),
    urlPath: getRawRequestPath(path || ""),
    method: headers[":method"] as string,
    headers: headers,
    route: path ? buildRouteFromURL(path) : undefined,
    query: queryObject,
    source: `${module}.createServer`,
    routeParams: {},
    cookies: headers?.cookie ? parse(headers.cookie) : {},
    body: undefined,
    remoteAddress: getIPAddressFromRequest({
      headers: headers,
      remoteAddress: stream.session?.socket.remoteAddress,
    }),
  };
}
