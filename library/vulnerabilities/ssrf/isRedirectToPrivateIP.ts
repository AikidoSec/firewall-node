import { Context } from "../../agent/Context";
import { containsPrivateIPAddress } from "./containsPrivateIPAddress";
import { findHostnameInContext } from "./findHostnameInContext";
import { getRedirectOrigin } from "./getRedirectOrigin";

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
