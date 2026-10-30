import { Context, getContext } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import type { H3Event } from "h3";
import type { PartialH3Exports } from "../H3";
import { isTrustedProxyRequest } from "../../helpers/trustProxy";

export function contextFromEvent(
  event: H3Event,
  h3: PartialH3Exports
): Context {
  const existingContext = getContext();
  const headers = h3.getHeaders(event);
  const url = getURL(event, h3);
  const rawRemoteAddress = event.node.req.socket.remoteAddress;

  return {
    method: event.method,
    remoteAddress: getIPAddressFromRequest({
      headers: headers,
      remoteAddress: rawRemoteAddress,
    }),
    isBehindTrustedProxy: isTrustedProxyRequest(rawRemoteAddress),
    body:
      existingContext && existingContext.source === "h3"
        ? existingContext.body
        : undefined,
    url: url,
    headers: headers,
    routeParams: event.context.params,
    query: h3.getQuery(event),
    cookies: h3.parseCookies(event),
    source: "h3",
    route: buildRouteFromURL(url),
  };
}

function getURL(event: H3Event, h3: PartialH3Exports): string {
  try {
    return h3.getRequestURL(event).toString();
  } catch {
    return event.node.req.originalUrl || event.path || "/";
  }
}
