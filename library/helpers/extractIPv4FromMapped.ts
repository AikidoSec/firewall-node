import { Network } from "./ip-matcher/Network";

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

  return `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
}
