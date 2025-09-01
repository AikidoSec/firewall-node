import { Context } from "../../agent/Context";

// Prevent excessive recursion
// We expect the http client to have a much lower redirect limit
const maxRecursionDepth = 100;

/**
 * This function checks if the given URL is part of a redirect chain that is passed in the `redirects` parameter.
 * It returns the origin of a redirect chain if the URL is the result of a redirect.
 * The origin is the first URL in the chain, so the initial URL that was requested and redirected to the given URL
 * or in case of multiple redirects the URL that was redirected to the given URL.
 *
 * Example:
 * Redirect chain: A -> B -> C: getRedirectOrigin([A -> B, B -> C], C) => A
 *                            : getRedirectOrigin([A -> B, B -> C], B) => A
 *                            : getRedirectOrigin([A -> B, B -> C], D) => undefined
 */
export function getRedirectOrigin(
  redirects: Context["outgoingRequestRedirects"],
  url: URL
): URL | undefined {
  if (!Array.isArray(redirects)) {
    return undefined;
  }

  const origin = findOrigin(redirects, url);

  // If the origin is the same as the input URL, there's no redirect origin
  return origin.href === url.href ? undefined : origin;
}

function findOrigin(
  redirects: NonNullable<Context["outgoingRequestRedirects"]>,
  url: URL,
  visited: Set<string> = new Set(),
  depth: number = 0
): URL {
  if (visited.has(url.href) || depth > maxRecursionDepth) {
    // To avoid infinite loops in case of cyclic redirects
    return url;
  }

  visited.add(url.href);

  // Find a redirect where the current URL is the destination
  const redirect = redirects.find((r) => r.destination.href === url.href);

  if (redirect) {
    // Recursively find the origin starting from the source URL
    return findOrigin(redirects, redirect.source, visited, depth + 1);
  }

  // If no redirect leads to this URL, return the URL itself
  return url;
}
