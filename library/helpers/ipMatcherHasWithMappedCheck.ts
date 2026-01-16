import { extractIPv4FromMapped } from "./extractIPv4FromMapped";
import { IPMatcher } from "./ip-matcher/IPMatcher";

/**
 * Check if an IP is in the matcher, also checking IPv4 if it's an IPv4-mapped IPv6 address.
 * Use this for large lists where we check at lookup time to save memory.
 */
export function ipMatcherHasWithMappedCheck(
  matcher: IPMatcher,
  ip: string
): boolean {
  if (matcher.has(ip)) {
    return true;
  }

  const ipv4 = extractIPv4FromMapped(ip);
  if (ipv4) {
    return matcher.has(ipv4);
  }

  return false;
}
