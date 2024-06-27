// IMDS IP address
export const blockedIPs = ["169.254.169.254"];

export const truestedHosts = ["metadata.google.internal", "metadata.goog"];

export function isBlockedIP(ip: string): boolean {
  return blockedIPs.includes(ip);
}

export function isTrustedHost(host: string): boolean {
  return truestedHosts.includes(host);
}
