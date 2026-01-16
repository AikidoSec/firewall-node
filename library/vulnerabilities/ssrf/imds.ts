import { addIPv4MappedAddresses } from "../../helpers/addIPv4MappedAddresses";
import { IPMatcher } from "../../helpers/ip-matcher/IPMatcher";

// These IP addresses are used to access the instance metadata service (IMDS)
// We should block any requests to these IP addresses
// This prevents STORED SSRF attacks that try to access the instance metadata service
// Small list, frequently accessed: add IPv4-mapped versions at creation time for fast lookups
const IMDSAddresses = new IPMatcher();
for (const ip of addIPv4MappedAddresses([
  "169.254.169.254",
  "fd00:ec2::254",
  "100.100.100.200",
])) {
  IMDSAddresses.add(ip);
}

export function isIMDSIPAddress(ip: string): boolean {
  return IMDSAddresses.has(ip);
}

// Google cloud uses the same IP addresses for its metadata service
// However, you need to set specific headers to access it
// In order to not block legitimate requests, we should allow the IP addresses for Google Cloud
const trustedHosts = ["metadata.google.internal", "metadata.goog"];

export function isTrustedHostname(hostname: string): boolean {
  return trustedHosts.includes(hostname);
}
