import { BlockList, isIPv4, isIPv6 } from "net";
import { tryParseURL } from "../../helpers/tryParseURL";
import { IPv4 } from "./IPv4";
import { IPv6 } from "./IPv6";

// Taken from https://github.com/frenchbread/private-ip/blob/master/src/index.ts
const PRIVATE_IP_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.0.0/29",
  "192.0.0.8/32",
  "192.0.0.9/32",
  "192.0.0.10/32",
  "192.0.0.170/32",
  "192.0.0.171/32",
  "192.0.2.0/24",
  "192.31.196.0/24",
  "192.52.193.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "192.175.48.0/24",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "240.0.0.0/4",
  "255.255.255.255/32",
];

const PRIVATE_IPV6_RANGES = [
  "::/128",
  "::1/128",
  "fe80::/64",
  "ff00::/8",
  "fc00::/7",
];

const privateIp = new BlockList();
const IPv4Parser = new IPv4();
const IPv6Parser = new IPv6();

PRIVATE_IP_RANGES.forEach((range) => {
  const [ip, mask] = range.split("/");
  privateIp.addSubnet(ip, parseInt(mask, 10));
});

PRIVATE_IPV6_RANGES.forEach((range) => {
  const [ip, mask] = range.split("/");
  privateIp.addSubnet(ip, parseInt(mask, 10), "ipv6");
});

export function isPrivateIP(ip: string): boolean {
  if (isIPv4(ip) && privateIp.check(ip)) {
    return true;
  }

  return isIPv6(ip) && privateIp.check(ip, "ipv6");
}

export function isPrivateHostname(hostname: string): boolean {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const ipv6 = hostname.substring(1, hostname.length - 1);
    if (isIPv6(ipv6)) {
      const normalized = IPv6Parser.normalizeIPAddress(ipv6);
      if (normalized && privateIp.check(normalized, "ipv6")) {
        return true;
      }
    }
  }

  try {
    const normalized = IPv4Parser.normalizeIPAddress(hostname);
    if (normalized) {
      hostname = normalized;
    }
  } catch (error) {
    // IP could not be normalized, assuming that it can not be resolved by fetch/http either
    return false;
  }

  if (hostname && privateIp.check(hostname)) {
    return true;
  }

  return false;
}

export function findHostnameInUserInput(
  userInput: string,
  hostname: string
): boolean {
  if (userInput.length <= 1) {
    return false;
  }

  if (!userInput.includes(hostname)) {
    return false;
  }

  const variants = [userInput, `http://${userInput}`];
  for (const variant of variants) {
    const url = tryParseURL(variant);
    if (url && url.hostname === hostname) {
      return true;
    }
  }

  return false;
}

export function detectSSRF(userInput: string, hostname: string): boolean {
  const found = findHostnameInUserInput(userInput, hostname);

  return found && isPrivateHostname(hostname);
}
