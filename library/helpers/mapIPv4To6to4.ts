import { splitCIDR } from "./splitCIDR";

/**
 * Maps an IPv4 address to its 6to4 (RFC 3056) IPv6 representation.
 * 6to4 embeds the IPv4 address as two hex groups right after the 2002:: prefix.
 * e.g. mapIPv4To6to4("10.0.0.1") -> "2002:a00:1::/128"
 * e.g. mapIPv4To6to4("10.0.0.0/8") -> "2002:a00:0::/24"
 */
export function mapIPv4To6to4(ip: string): string {
  const [address, suffix] = splitCIDR(ip);
  const octets = address.split(".").map(Number);
  const first = ((octets[0] << 8) | octets[1]).toString(16);
  const second = ((octets[2] << 8) | octets[3]).toString(16);
  return `2002:${first}:${second}::/${suffix + 16}`;
}
