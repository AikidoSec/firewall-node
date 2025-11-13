import { IPMatcher } from "../../helpers/ip-matcher/IPMatcher";
import mapIPv4ToIPv6 from "../../helpers/mapIPv4ToIPv6";

const IMDSAddresses = new IPMatcher();

// This IP address is used by AWS EC2 instances to access the instance metadata service (IMDS)
// We should block any requests to these IP addresses
// This prevents STORED SSRF attacks that try to access the instance metadata service
IMDSAddresses.add("169.254.169.254");
IMDSAddresses.add(mapIPv4ToIPv6("169.254.169.254"));
IMDSAddresses.add("fd00:ec2::254");
IMDSAddresses.add("100.100.100.200"); // Alibaba Cloud
IMDSAddresses.add(mapIPv4ToIPv6("100.100.100.200"));

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
