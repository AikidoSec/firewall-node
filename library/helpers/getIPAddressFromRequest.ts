import { isIP } from "net";
import { isPrivateIP } from "../vulnerabilities/ssrf/isPrivateIP";

export function getIPAddressFromRequest(req: {
  headers: Record<string, unknown>;
  remoteAddress: string | undefined;
}) {
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

  if (req.remoteAddress && isIP(req.remoteAddress)) {
    return req.remoteAddress;
  }

  return undefined;
}

function getClientIpFromXForwardedFor(value: string) {
  const forwardedIps = value.split(",").map((e) => {
    const ip = e.trim();

    if (isIP(ip)) {
      return ip;
    }

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
