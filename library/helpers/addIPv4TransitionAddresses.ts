import { mapIPv4To6to4 } from "./mapIPv4To6to4";
import { mapIPv4WithIPv6Prefix } from "./mapIPv4WithIPv6Prefix";

/**
 * Adds IPv4-in-IPv6 transition mechanism versions for all IPv4 addresses in the array.
 */
export function addIPv4TransitionAddresses(ips: string[]): string[] {
  const ipv4Addresses = ips.filter((ip) => !ip.includes(":"));

  return ips.concat(
    ipv4Addresses.flatMap((ip) => [
      mapIPv4WithIPv6Prefix(ip, "64:ff9b::", 96), // Well-Known NAT64 prefix (RFC 6052)
      mapIPv4WithIPv6Prefix(ip, "64:ff9b:1::", 96), // Local-Use NAT64 prefix (RFC 8215)
      mapIPv4WithIPv6Prefix(ip, "::", 96), // IPv4-compatible IPv6 address (RFC 4291)
      mapIPv4To6to4(ip), // 6to4 (RFC 3056)
    ])
  );
}
