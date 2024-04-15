import { BlockList, isIPv4, isIPv6 } from "net";

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

const privateIp = new BlockList();
PRIVATE_IP_RANGES.forEach((range) => {
  const [ip, mask] = range.split("/");
  privateIp.addSubnet(ip, parseInt(mask, 10));
});

function isPrivateIPv6(ip: string) {
  return (
    /^::$/.test(ip) ||
    /^::1$/.test(ip) ||
    /^::f{4}:([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/.test(
      ip
    ) ||
    /^::f{4}:0.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/.test(
      ip
    ) ||
    /^64:ff9b::([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/.test(
      ip
    ) ||
    /^100::([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4})$/.test(
      ip
    ) ||
    /^2001::([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4})$/.test(
      ip
    ) ||
    /^2001:2[0-9a-fA-F]:([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4})$/.test(
      ip
    ) ||
    /^2001:db8:([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4})$/.test(
      ip
    ) ||
    /^2002:([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4}):?([0-9a-fA-F]{0,4})$/.test(
      ip
    ) ||
    /^f[c-d]([0-9a-fA-F]{2,2}):/i.test(ip) ||
    /^fe[8-9a-bA-B][0-9a-fA-F]:/i.test(ip) ||
    /^ff([0-9a-fA-F]{2,2}):/i.test(ip)
  );
}

function isPrivateHostname(hostname: string): boolean {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    const ipv6 = hostname.substring(1, hostname.length - 1);
    if (isIPv6(ipv6) && isPrivateIPv6(ipv6)) {
      return true;
    }
  }

  if (isIPv4(hostname) && privateIp.check(hostname)) {
    return true;
  }

  return hostname === "localhost";
}

export function detectSSRF(userInput: string, hostname: string): boolean {
  if (userInput.length <= 1) {
    return false;
  }

  // e.g. ftp://localhost or https://domain.com
  const parts = userInput.split("://");
  if (parts.length > 1 && parts[1].startsWith(hostname)) {
    return isPrivateHostname(hostname);
  }

  return userInput.startsWith(hostname) && isPrivateHostname(hostname);
}
