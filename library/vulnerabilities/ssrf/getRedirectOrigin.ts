import { Context } from "../../agent/Context";
/**
 * This function checks if the given URL is part of a redirect chain that is passed in the redirects parameter.
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
) {
  if (!Array.isArray(redirects)) {
    return undefined;
  }

  let currentUrl = url;

  // Follow the redirect chain until we reach the origin or don't find a redirect
  while (true) {
    const redirect = redirects.find(
      // url.href contains the full URL so we can use it for comparison
      (r) => r.destination.href === currentUrl.href
    );
    if (!redirect) {
      break;
    }
    currentUrl = redirect.source;
  }

  return currentUrl.href === url.href ? undefined : currentUrl;
}
