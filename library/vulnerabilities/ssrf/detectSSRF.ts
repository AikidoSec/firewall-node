import { isIP } from "net";
import { BlockList } from "node:net";

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

export function detectSSRF(userInput: string, hostname: string): boolean {
  if (userInput.length <= 1) {
    return false;
  }

  if (!userInput.includes(hostname)) {
    return false;
  }

  if (isIP(hostname) === 4 && privateIp.check(hostname)) {
    return true;
  }

  return hostname === "localhost";
}
