import { tryParseURL } from "../../helpers/tryParseURL";
import { isPrivateIP } from "./isPrivateIP";

export function isPrivateHostname(hostname: string): boolean {
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
