import { BlockList, isIPv4, isIPv6 } from "net";

function getIPAddressType(ip: string): "ipv4" | "ipv6" | undefined {
  if (isIPv4(ip)) {
    return "ipv4";
  }
  if (isIPv6(ip)) {
    return "ipv6";
  }
  return undefined;
}

export function addIPAddressToBlocklist(
  ip: string,
  blocklist: BlockList
): boolean {
  const isCIDR = ip.includes("/");

  if (!isCIDR) {
    const type = getIPAddressType(ip);
    if (!type) {
      return false;
    }
    blocklist.addAddress(ip, type);
    return true;
  }

  const [plainIP, rangeStr] = ip.split("/");

  const type = getIPAddressType(plainIP);
  if (!type) {
    return false;
  }

  const range = parseInt(rangeStr, 10);

  if (Number.isNaN(range) || range < 1) {
    return false;
  }

  if (range > 32 && type === "ipv4") {
    return false;
  }

  if (range > 128 && type === "ipv6") {
    return false;
  }

  blocklist.addSubnet(plainIP, range, type);
  return true;
}
