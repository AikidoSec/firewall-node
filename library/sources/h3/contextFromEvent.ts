import { Context, getContext } from "../../agent/Context";
import { buildRouteFromURL } from "../../helpers/buildRouteFromURL";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";
import { parse } from "../../helpers/parseCookies";
import type { EventHandlerRequest, H3Event } from "h3";

export async function contextFromEvent(
  event: H3Event<EventHandlerRequest>,
  h3: typeof import("h3")
): Promise<Context> {
  const existingContext = getContext();

  const headers = h3.getHeaders(event);
  const cookieHeader = headers.cookie;

  const url = h3.getRequestURL(event).toString();

  return {
    method: event.method,
    remoteAddress: getIPAddressFromRequest({
      headers: headers,
      remoteAddress: h3.getRequestIP(event, {
        xForwardedFor: false,
      }),
    }),
    // Pass the body from the existing context if it's already set, otherwise the body is set in wrapRequestBodyParsing
    body:
      existingContext && existingContext.source === "h3"
        ? existingContext.body
        : undefined,
    url: url,
    headers: headers,
    routeParams: h3.getRouterParams(event),
    query: h3.getQuery(event),
    cookies: cookieHeader ? parse(cookieHeader) : {},
    source: "h3",
    route: buildRouteFromURL(url),
  };
}
