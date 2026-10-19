import { domainToUnicode } from "url";

/**
 * Converts a punycode hostname to its unicode form.
 * e.g. "xn--mnchen-3ya.example.com" -> "münchen.example.com"
 *
 * Returns the original hostname if conversion fails or produces an empty result.
 */
export function hostnameToUnicode(hostname: string): string {
  try {
    const unicode = domainToUnicode(hostname);
    if (unicode) {
      return unicode;
    }
  } catch {
    // Ignore
  }

  return hostname;
}
