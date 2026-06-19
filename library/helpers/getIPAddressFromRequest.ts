import { isIP } from "net";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import { trustProxy } from "./trustProxy";
import { getTrustedProxyCount } from "./trustedProxyCount";

export function getIPAddressFromRequest(req: {
  headers: Record<string, unknown>;
  remoteAddress: string | undefined;
}) {
  if (req.headers) {
    const ipHeaderName = getIpHeaderName();
    if (typeof req.headers[ipHeaderName] === "string" && trustProxy()) {
      const ipHeaderValue = getClientIpFromHeader(
        req.headers[ipHeaderName],
        getTrustedProxyCount()
      );

      if (ipHeaderValue && isIP(ipHeaderValue)) {
        return ipHeaderValue;
      }
    }
  }

  if (req.remoteAddress) {
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

function getClientIpFromHeader(value: string, trustedProxyCount: number) {
  const forwardedIps = value.split(",").map((e) => {
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
  });

  // Walk right-to-left. Private IPs are always skipped. Each non-private IP we
  // encounter is a trusted proxy; we skip (trustedProxyCount - 1) of them and
  // return the next one as the real client IP.
  let publicProxiesSkipped = 0;
  for (let i = forwardedIps.length - 1; i >= 0; i--) {
    if (!isIP(forwardedIps[i]) || isPrivateIP(forwardedIps[i])) {
      continue;
    }
    publicProxiesSkipped++;
    if (publicProxiesSkipped >= trustedProxyCount) {
      return forwardedIps[i];
    }
  }

  return null;
}
