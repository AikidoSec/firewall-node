import { Context } from "../../agent/Context";

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

  // Keep track of visited URLs to avoid infinite loops
  const visited: Set<string> = new Set();
  let currentUrl: URL = url;
  let foundRedirect: boolean;

  do {
    foundRedirect = false;

    // Filter redirects that have not been visited
    const unvisitedRedirects = redirects.filter(
      (r) => !visited.has(r.destination.href)
    );

    // If no unvisited redirects are left, exit the loop
    if (unvisitedRedirects.length === 0) {
      break;
    }

    for (const redirect of unvisitedRedirects) {
      if (redirect.destination.href === currentUrl.href) {
        visited.add(redirect.destination.href);
        currentUrl = redirect.source;
        foundRedirect = true;
        break;
      }
    }
  } while (foundRedirect);

  // If the final URL is the same as the starting URL, return undefined (no redirect origin)
  return currentUrl.href === url.href ? undefined : currentUrl;
}
