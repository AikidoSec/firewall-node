import { tryParseURL } from "../../helpers/tryParseURL";

/**
 * Get the URL from the options object of a Undici request.
 */
export function getUrlFromOptions(opts: any) {
  if (typeof opts.origin === "string" && typeof opts.path === "string") {
    return tryParseURL(opts.origin + opts.path);
  } else if (opts.origin instanceof URL) {
    if (typeof opts.path === "string") {
      return tryParseURL(opts.origin.href + opts.path);
    } else {
      return opts.origin;
    }
  }
}
