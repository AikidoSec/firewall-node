/**
 * Maps an IPv4 address to an IPv6 address.
 * e.g. 127.0.0.1/8 -> ::ffff:127
 */
export default function mapIPv4ToIPv6(ip: string): string {
  if (!ip.includes("/")) {
    // No CIDR suffix, assume /32
    return `::ffff:${ip}/128`;
  }

  const parts = ip.split("/");
  const suffix = Number.parseInt(parts[1], 10);
  return `::ffff:${parts[0]}/${suffix + 96}`;
}
