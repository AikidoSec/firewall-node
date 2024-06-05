import type { Request } from "express";
import { Context } from "../../agent/Context";
import { getIPAddressFromRequest } from "../../helpers/getIPAddressFromRequest";

export function contextFromRequest(req: Request): Context {
  let route = undefined;
  if (typeof req.route?.path === "string") {
    route = req.route.path;
  } else if (req.route?.path instanceof RegExp) {
    route = req.route.path.toString();
  }

  return {
    method: req.method,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
    body: req.body ? req.body : undefined,
    url: req.protocol + "://" + req.get("host") + req.originalUrl,
    headers: req.headers,
    routeParams: req.params,
    query: req.query,
    /* c8 ignore next */
    cookies: req.cookies ? req.cookies : {},
    source: "express",
    route: route,
  };
}
