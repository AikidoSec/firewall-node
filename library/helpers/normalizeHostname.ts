import { domainToUnicode } from "url";

export function normalizeHostname(hostname: string): string {
  if (hostname.endsWith(".")) {
    hostname = hostname.slice(0, -1);
  }

  try {
    const unicode = domainToUnicode(hostname);
    if (unicode) {
      return unicode;
    }
  } catch {
    // Ignore - use original hostname
  }

  return hostname;
}
