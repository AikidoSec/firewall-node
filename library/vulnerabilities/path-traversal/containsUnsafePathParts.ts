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
 * See https://url.spec.whatwg.org/#url-parsing
 */
export function containsUnsafePathPartsUrl(filePath: string) {
  return /(?:\.(?:\t|\n|\r)?){2}(?:\/|\\)/.test(filePath);
}
