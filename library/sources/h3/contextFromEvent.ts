import { Context, getContext } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import type { H3Event } from "h3";
import type { PartialH3Exports } from "../H3";

export function contextFromEvent(
  event: H3Event,
  h3: PartialH3Exports
): Context {
  const existingContext = getContext();
  const headers = h3.getHeaders(event);
  const url = h3.getRequestURL(event).toString();

  return {
    method: event.method,
    remoteAddress: getIPAddressFromRequest({
      headers: headers,
      remoteAddress:
        event.context.clientAddress || event.node.req.socket.remoteAddress,
    }),
    // Pass the body from the existing context if it's already set, otherwise the body is set in wrapRequestBodyParsing
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
