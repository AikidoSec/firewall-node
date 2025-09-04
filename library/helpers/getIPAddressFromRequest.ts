import { isIP } from "net";
import { trustProxy } from "./trustProxy";
import { IPMatcher } from "./ip-matcher/IPMatcher";

export function getIPAddressFromRequest(req: {
  headers: Record<string, unknown>;
  remoteAddress: string | undefined;
}) {
  const trustConfig = trustProxy();

  if (req.headers) {
    const ipHeaderName = getIpHeaderName();
    if (
      typeof req.headers[ipHeaderName] === "string" &&
      trustConfig.trust !== "none"
    ) {
      const ipHeaderValue = getClientIpFromHeader(
        req.headers[ipHeaderName],
        trustConfig
      );

      if (ipHeaderValue && isIP(ipHeaderValue)) {
        return ipHeaderValue;
      }
    }
  }

  if (req.remoteAddress && isIP(req.remoteAddress)) {
    return req.remoteAddress;
  }

  return undefined;
}

function getIpHeaderName(): string {
  if (process.env.AIKIDO_CLIENT_IP_HEADER) {
    return process.env.AIKIDO_CLIENT_IP_HEADER.toLowerCase();
  }

  return "x-forwarded-for";
}

function getClientIpFromHeader(
  value: string,
  trustConfig: { trust: "all" } | { trust: string[] }
) {
  const forwardedIps = value
    .split(",")
    .map((e) => {
      const ip = e.trim();

      // We do a first check here to make sure that valid IPv6 addresses don't
      // get split on ":" below.
      if (isIP(ip)) {
        return ip;
      }

      // Normalize IPv6 without port by removing brackets
      if (ip.startsWith("[") && ip.endsWith("]")) {
        return ip.slice(1, -1);
      }

      // According to https://www.rfc-editor.org/rfc/rfc7239 (5.2) X-Forwarded-For
      // is allowed to include a port number, so we check this here, first for IPv6
      if (ip.startsWith("[")) {
        // IPv6 with port: [ip]:port
        const closingBracket = ip.indexOf("]:");
        if (closingBracket > 0) {
          return ip.slice(1, closingBracket);
        }
      }

      // Handle IPv4 with port: ip:port
      if (ip.includes(":")) {
        const parts = ip.split(":");
        if (parts.length === 2) {
          return parts[0];
        }
      }

      return ip;
    })
    .filter(isIP);

  const trustedProxyMatcher = new IPMatcher(
    Array.isArray(trustConfig.trust) ? trustConfig.trust : []
  );

  function isTrusted(ip: string) {
    if (trustConfig.trust === "all") {
      return true;
    }

    return trustedProxyMatcher.has(ip);
  }

  for (let i = forwardedIps.length - 1; i >= 0; i--) {
    const ip = forwardedIps[i];
    if (!isTrusted(ip)) {
      // Return the first untrusted IP address from the right
      return ip;
    }
  }

  if (forwardedIps.length > 0) {
    return forwardedIps[0];
  }

  return undefined;
}
