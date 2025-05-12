import { getRawUrlPath } from "../../helpers/getRawUrlPath";

const forbiddenPattern = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Check if the URL path contains a path traversal attack
 * A legitimate URL path should not contain ".." or "/../" or "\..\" or "\..\"
 * https://datatracker.ietf.org/doc/html/rfc3986#section-5.2.4
 */
export function checkUrlPathForPathTraversal(url: string | undefined): {
  found: boolean;
  payload?: string;
} {
  if (!url || url.length < 3) {
    // Performance optimization, url most include at least 3 characters (/..)
    return {
      found: false,
    };
  }

  const rawPath = getRawUrlPath(url);
  if (rawPath.length < 3) {
    // Performance optimization, we don't need to check for path traversal if the path is less than 3 characters
    // Can happen if the URL has a query string
    return {
      found: false,
    };
  }

  if (forbiddenPattern.test(rawPath)) {
    return {
      found: true,
      payload: rawPath,
    };
  }

  if (!url.includes("%")) {
    // Performance optimization, if the URL does not contain any encoded characters, we don't need to decode it
    return {
      found: false,
    };
  }

  // Also check encoded paths
  const decodedPath = decodeURIComponent(rawPath);

  if (forbiddenPattern.test(decodedPath)) {
    return {
      found: true,
      payload: rawPath,
    };
  }

  return {
    found: false,
  };
}
