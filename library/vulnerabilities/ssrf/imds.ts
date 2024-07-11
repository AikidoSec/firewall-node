import { BlockList } from "net";

let IMDSAddresses: BlockList;

function initIMDSAddresses() {
  IMDSAddresses = new BlockList();

  // This IP address is used by AWS EC2 instances to access the instance metadata service (IMDS)
  // We should block any requests to these IP addresses
  // This prevents STORED SSRF attacks that try to access the instance metadata service
  IMDSAddresses.addAddress("169.254.169.254", "ipv4");
  IMDSAddresses.addAddress("fd00:ec2::254", "ipv6");
}

export function isIMDSIPAddress(ip: string): boolean {
  if (!IMDSAddresses) {
    initIMDSAddresses();
  }
  return IMDSAddresses.check(ip) || IMDSAddresses.check(ip, "ipv6");
}

// Google cloud uses the same IP addresses for its metadata service
// However, you need to set specific headers to access it
// In order to not block legitimate requests, we should allow the IP addresses for Google Cloud
const trustedHosts = ["metadata.google.internal", "metadata.goog"];

export function isTrustedHostname(hostname: string): boolean {
  return trustedHosts.includes(hostname);
}
