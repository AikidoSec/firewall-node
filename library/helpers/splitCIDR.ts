/**
 * Splits an IP address into its address part and prefix length.
 * e.g. "10.0.0.0/8" -> ["10.0.0.0", 8], "127.0.0.1" -> ["127.0.0.1", 32]
 * e.g. "::1" -> ["::1", 128]
 */
export function splitCIDR(ip: string): [string, number] {
  if (!ip.includes("/")) {
    return [ip, ip.includes(":") ? 128 : 32];
  }
  const [address, suffix] = ip.split("/");
  return [address, Number.parseInt(suffix, 10)];
}
