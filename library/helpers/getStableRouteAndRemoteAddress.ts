import type { IncomingMessage } from "http";
import { buildRouteFromURL } from "./buildRouteFromURL";
import { getIPAddressFromRequest } from "./getIPAddressFromRequest";

type StableRouteAndRemoteAddress = {
  route: string | undefined;
  remoteAddress: string | undefined;
};

const stableValues = Symbol("stableRouteAndRemoteAddress");

type Request = IncomingMessage & {
  originalUrl?: string;
  [stableValues]?: StableRouteAndRemoteAddress;
};

export function getStableRouteAndRemoteAddress(
  req: Request
): StableRouteAndRemoteAddress {
  const cached = req[stableValues];
  if (cached) {
    return cached;
  }

  const url = typeof req.originalUrl === "string" ? req.originalUrl : req.url;
  const values = {
    route: url ? buildRouteFromURL(url) : undefined,
    remoteAddress: getIPAddressFromRequest({
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress,
    }),
  };

  req[stableValues] = values;
  return values;
}
