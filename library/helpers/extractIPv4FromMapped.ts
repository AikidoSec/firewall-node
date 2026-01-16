import { Network } from "./ip-matcher/Network";

/**
 * Extracts the IPv4 address from an IPv4-mapped IPv6 address.
 * Handles all formats:
 * - ::ffff:192.0.2.1
 * - ::ffff:c000:201
 * - 0000:0000:0000:0000:0000:ffff:c000:0201
 * - [::ffff:192.0.2.1]
 *
 * @returns The IPv4 address string, or null if not an IPv4-mapped address
 */
export function extractIPv4FromMapped(ip: string): string | null {
  const net = new Network(ip);
  if (!net.isValid()) {
    return null;
  }

  const bytes = net.addr.bytes();
  if (bytes.length !== 16) {
    return null;
  }

  // Check IPv4-mapped: first 10 bytes = 0, bytes 10-11 = 0xffff
  for (let i = 0; i < 10; i++) {
    if (bytes[i] !== 0) {
      return null;
    }
  }
  if (bytes[10] !== 255 || bytes[11] !== 255) {
    return null;
  }

  // Extract IPv4 from last 4 bytes
  return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}
