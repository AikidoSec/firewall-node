import { splitCIDR } from "./splitCIDR";

/**
 * Embeds an IPv4 address as the trailing bits of a fixed-length IPv6 prefix.
 * Used for transition mechanisms that place the IPv4 address at the end of the
 * address, e.g. NAT64 (64:ff9b::/96) and IPv4-compatible addresses (::/96).
 */
export function mapIPv4WithIPv6Prefix(
  ip: string,
  prefix: string,
  prefixBitLength: number
): string {
  const [address, suffix] = splitCIDR(ip);
  return `${prefix}${address}/${suffix + prefixBitLength}`;
}
