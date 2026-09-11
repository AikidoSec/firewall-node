const dangerousPathParts = ["../", "..\\"];

// The WHATWG URL spec treats these as equivalent to a literal ".." path
// segment when the URL parser removes dot segments from a URL's path.
// This lets a URL like new URL("%2e%2e/etc/passwd", base) traverse out of
// `base` without the string "../" ever appearing in the resulting path.
// See https://url.spec.whatwg.org/#double-dot-path-segment
const dangerousUrlPathSegments = ["..", ".%2e", "%2e.", "%2e%2e"];

export function containsUnsafePathParts(filePath: string) {
  for (const dangerousPart of dangerousPathParts) {
    if (filePath.includes(dangerousPart)) {
      return true;
    }
  }

  return false;
}

/**
 * This function is used for urls, because they can contain a TAB, carriage return or line feed that is silently removed by the URL constructor.
 * It also recognizes percent-encoded dot segments (e.g. "%2e%2e"),
 * because the WHATWG URL parser normalizes them the same way as a literal ".." segment.
 *
 * The WHATWG URL spec defines the following:
 * - Remove all ASCII tab or newline from input.
 * - An ASCII tab or newline is U+0009 TAB, U+000A LF, or U+000D CR.
 *
 * See https://url.spec.whatwg.org/#url-parsing
 */
export function containsUnsafePathPartsUrl(filePath: string) {
  const normalized = filePath.replace(/[\t\n\r]/g, "");
  if (containsUnsafePathParts(normalized)) {
    return true;
  }

  const segments = normalized.toLowerCase().split(/[/\\]/);
  return segments.some((segment) => dangerousUrlPathSegments.includes(segment));
}
