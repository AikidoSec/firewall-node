import { tryParseURL } from "../../helpers/tryParseURL";
import { isPrivateIP } from "./isPrivateIP";

/**
 * Check if the hostname contains a private IP address
 * This function is used to detect obvious SSRF attacks (with a private IP address being used as the hostname)
 *
 * Examples
 * http://192.168.0.1/some/path
 * http://[::1]/some/path
 * http://localhost/some/path
 *
 * This function gets to see "192.168.0.1", "[::1]", and "localhost"
 *
 * We won't flag this-domain-points-to-a-private-ip.com
 * This will be handled by the inspectDNSLookupCalls function
 */
export function containsPrivateIPAddress(hostname: string): boolean {
  if (hostname === "localhost") {
    return true;
  }

  const url = tryParseURL(`http://${hostname}`);
  if (!url) {
    return false;
  }

  // IPv6 addresses are enclosed in square brackets
  // e.g. http://[::1]
  if (url.hostname.startsWith("[") && url.hostname.endsWith("]")) {
    const ipv6 = url.hostname.substring(1, url.hostname.length - 1);
    if (isPrivateIP(ipv6)) {
      return true;
    }
  }

  return isPrivateIP(url.hostname);
}
