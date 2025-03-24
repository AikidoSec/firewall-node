/**
 * Maps an IPv4 address to an IPv6 address.
 * e.g. 127.0.0.0/8 -> ::ffff:127.0.0.0/104
 */
export default function mapIPv4ToIPv6(ip: string): string {
  if (!ip.includes("/")) {
    // No CIDR suffix, assume /32
    return `::ffff:${ip}/128`;
  }

  const parts = ip.split("/");
  const suffix = Number.parseInt(parts[1], 10);
  // we add 96 to the suffix, since ::ffff: already is 96 bits, so the 32 remaining bits are decided by the IPv4 address
  return `::ffff:${parts[0]}/${suffix + 96}`;
}
