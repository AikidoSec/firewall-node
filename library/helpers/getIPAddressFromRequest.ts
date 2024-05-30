import type { IncomingMessage } from "http";
import { isIP } from "net";

export function getIPAddressFromRequest(req: IncomingMessage) {
  if (req.headers) {
    if (typeof req.headers["x-forwarded-for"] === "string" && trustProxy()) {
      const xForwardedFor = getClientIpFromXForwardedFor(
        req.headers["x-forwarded-for"]
      );

      if (xForwardedFor && isIP(xForwardedFor)) {
        return xForwardedFor;
      }
    }
  }

  if (
    req.socket &&
    req.socket.remoteAddress &&
    isIP(req.socket.remoteAddress)
  ) {
    return req.socket.remoteAddress;
  }

  return undefined;
}

function getClientIpFromXForwardedFor(value: string) {
  const forwardedIps = value.split(",").map((e) => {
    const ip = e.trim();

    if (ip.includes(":")) {
      const parts = ip.split(":");

      if (parts.length === 2) {
        return parts[0];
      }
    }

    return ip;
  });

  for (let i = 0; i < forwardedIps.length; i++) {
    if (isIP(forwardedIps[i])) {
      return forwardedIps[i];
    }
  }

  return null;
}

function trustProxy() {
  if (!process.env.AIKIDO_TRUST_PROXY) {
    // Trust proxy by default
    // Most of the time, the application is behind a reverse proxy
    return true;
  }

  return (
    process.env.AIKIDO_TRUST_PROXY === "1" ||
    process.env.AIKIDO_TRUST_PROXY === "true"
  );
}
