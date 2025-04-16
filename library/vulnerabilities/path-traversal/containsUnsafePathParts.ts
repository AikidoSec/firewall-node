const dangerousPathParts = ["../", "..\\"];

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
 *
 * The WHATWG URL spec defines the following:
 * - Remove all ASCII tab or newline from input.
 * - An ASCII tab or newline is U+0009 TAB, U+000A LF, or U+000D CR.
 *
 * See https://url.spec.whatwg.org/#url-parsing
 */
export function containsUnsafePathPartsUrl(filePath: string) {
  return /(?:\.(?:\t|\n|\r)?){2}(?:\/|\\)/.test(filePath);
}
