import mapIPv4ToIPv6 from "./mapIPv4ToIPv6";

/**
 * Adds IPv4-mapped IPv6 versions for all IPv4 addresses in the array.
 * e.g. ["1.2.3.4", "2001:db8::/32"] -> ["1.2.3.4", "2001:db8::/32", "::ffff:1.2.3.4/128"]
 */
export function addIPv4MappedAddresses(ips: string[]): string[] {
  const ipv4Addresses = ips.filter((ip) => !ip.includes(":"));
  return ips.concat(ipv4Addresses.map(mapIPv4ToIPv6));
}
