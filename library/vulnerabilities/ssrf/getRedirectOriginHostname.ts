import { Context } from "../../agent/Context";

export function getRedirectOriginHostname(
  redirects: Context["outgoingRequestRedirects"],
  url: URL
) {
  if (!Array.isArray(redirects)) {
    return undefined;
  }

  let currentUrl = url;

  while (true) {
    const redirect = redirects.find(
      (r) => r.destination.href === currentUrl.href
    );
    if (!redirect) {
      break;
    }
    currentUrl = redirect.source;
  }

  return currentUrl.href === url.href ? undefined : currentUrl.hostname;
}
