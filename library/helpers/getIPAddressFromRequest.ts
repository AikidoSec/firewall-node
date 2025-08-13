import { isIP } from "net";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";
import { trustProxy } from "./trustProxy";

export function getIPAddressFromRequest(req: {
  headers: Record<string, unknown>;
  remoteAddress: string | undefined;
}) {
  if (req.headers) {
    const ipHeaderName = getIpHeaderName();
    if (typeof req.headers[ipHeaderName] === "string" && trustProxy()) {
      const ipHeaderValue = getClientIpFromHeader(req.headers[ipHeaderName]);

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

function getClientIpFromHeader(value: string) {
  const forwardedIps = value.split(",").map((e) => {
    const ip = e.trim();

    // We do a first check here to make sure that valid IPv6 addresses don't
    // get split on ":" below.
    if (isIP(ip)) {
      return ip;
    }

    // According to https://www.rfc-editor.org/rfc/rfc7239 (5.2) X-Forwarded-For
    // is allowed to include a port number, so we check this here :
    if (ip.includes(":")) {
      const parts = ip.split(":");

      if (parts.length === 2) {
        return parts[0];
      }
    }

    return ip;
  });

  // When selecting an address from the X-Forwarded-For header,
  // we should select the first valid IP address that is not a private IP address
  for (let i = 0; i < forwardedIps.length; i++) {
    if (isIP(forwardedIps[i]) && !isPrivateIP(forwardedIps[i])) {
      return forwardedIps[i];
    }
  }

  return null;
}
