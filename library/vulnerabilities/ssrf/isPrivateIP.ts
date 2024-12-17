import { IPMatcher } from "../../helpers/ip-matcher/IPMatcher";

// Taken from https://github.com/frenchbread/private-ip/blob/master/src/index.ts
const PRIVATE_IP_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
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
  "224.0.0.0/4",
  "255.255.255.255/32",
];

const PRIVATE_IPV6_RANGES = [
  "::/128", // Unspecified address
  "::1/128", // Loopback address
  "fc00::/7", // Unique local address (ULA)
  "fe80::/10", // Link-local address (LLA)
  "::ffff:127.0.0.1/128", // IPv4-mapped address
];

const privateIp = new IPMatcher();

PRIVATE_IP_RANGES.forEach((range) => {
  privateIp.add(range);
});

PRIVATE_IPV6_RANGES.forEach((range) => {
  privateIp.add(range);
});

export function isPrivateIP(ip: string): boolean {
  return privateIp.has(ip);
}
