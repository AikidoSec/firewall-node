import { isIP } from "net";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import { getTrustProxyConfig, TrustProxyConfig } from "./trustProxy";

export function getIPAddressFromRequest(req: {
  headers: Record<string, unknown>;
  remoteAddress: string | undefined;
}) {
  const config = getTrustProxyConfig();
  if (config.type === "boolean" && !config.value) {
    if (req.remoteAddress) {
      return req.remoteAddress;
    }
  }

  if (req.headers) {
    const ipHeaderName = getIpHeaderName();
    if (typeof req.headers[ipHeaderName] === "string") {
      const ips = parseIPsFromHeader(req.headers[ipHeaderName]);
      const ip = selectClientIP(ips, config);

      if (ip) {
        return ip;
      }
    }
  }

  if (req.remoteAddress) {
    return req.remoteAddress;
  }

  return undefined;
}

function selectClientIP(
  ips: string[],
  config: TrustProxyConfig
): string | null {
  if (config.type === "count") {
    const idx = ips.length - config.value;
    if (idx >= 0) {
      const ip = ips[idx];
      if (isIP(ip) && !isPrivateIP(ip)) return ip;
    }
    return null;
  }

  // Search right-to-left for the first non-private IP not belonging to a trusted proxy
  for (let i = ips.length - 1; i >= 0; i--) {
    const ip = ips[i];
    if (!isIP(ip) || isPrivateIP(ip)) {
      continue;
    }
    if (config.type === "cidr" && config.matcher.hasWithMappedCheck(ip)) {
      continue;
    }

    return ip;
  }

  return null;
}

function getIpHeaderName(): string {
  if (process.env.AIKIDO_CLIENT_IP_HEADER) {
    return process.env.AIKIDO_CLIENT_IP_HEADER.toLowerCase();
  }
  return "x-forwarded-for";
}

function parseIPsFromHeader(value: string): string[] {
  return value.split(",").map((e) => {
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
}
