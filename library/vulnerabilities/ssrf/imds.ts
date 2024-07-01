import { BlockList } from "net";

const IMDSAddresses = new BlockList();

// This IP address is used by AWS EC2 instances to access the instance metadata service
// We should block any requests to this IP address
// This prevents STORED SSRF attacks that try to access the instance metadata service
IMDSAddresses.addAddress("169.254.169.254");

export function isIMDSIPAddress(ip: string): boolean {
  return IMDSAddresses.check(ip);
}

// Google also uses 169.254.169.254 for its metadata service
// However, you need to set specific headers to access it
// In order to not block legitimate requests, we should allow the IP address for Google Cloud
const trustedHosts = ["metadata.google.internal", "metadata.goog"];

export function isTrustedHostname(hostname: string): boolean {
  return trustedHosts.includes(hostname);
}
