import { Context } from "../../agent/Context";
import { containsPrivateIPAddress } from "./containsPrivateIPAddress";
import { findHostnameInContext } from "./findHostnameInContext";
import { getRedirectOrigin } from "./getRedirectOrigin";

/**
 * This function is called before a outgoing request is made.
 * It's used to prevent requests to private IP addresses after a redirect with a user-supplied URL (SSRF).
 * It returns true if the following conditions are met:
 * - context.outgoingRequestRedirects is set: Inside the context of this incoming request, there was a redirect
 * - The hostname of the URL contains a private IP address
 * - The redirect origin, so the user-supplied hostname and port that caused the first redirect, is found in the context of the incoming request
 */
export function isRedirectToPrivateIP(url: URL, context: Context) {
  if (
    context.outgoingRequestRedirects &&
    containsPrivateIPAddress(url.hostname)
  ) {
    const redirectOrigin = getRedirectOrigin(
      context.outgoingRequestRedirects,
      url
    );

    if (redirectOrigin) {
      return findHostnameInContext(
        redirectOrigin.hostname,
        context,
        parseInt(redirectOrigin.port, 10)
      );
    }
  }
  return undefined;
}
