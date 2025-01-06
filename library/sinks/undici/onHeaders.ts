import { parseHeaders } from "./parseHeaders";
import { isRedirectStatusCode } from "../../helpers/isRedirectStatusCode";
import type { Request } from "undici-v6";
import { addRedirectToContext } from "../../vulnerabilities/ssrf/addRedirectToContext";
import { getUrlFromOptions } from "./getUrlFromOptions";
import { getContext } from "../../agent/Context";

/**
 * Check if the response is a redirect. If yes, determine the destination URL.
 */
export function onHeaders(message: unknown) {
  try {
    const { request, response } = message as {
      request: Request;
      response: {
        statusCode: number;
        headers: Buffer[];
        statusText: string;
      };
    };

    const context = getContext();
    if (!context) {
      return;
    }

    // Check if the response is a redirect
    if (!isRedirectStatusCode(response.statusCode)) {
      return;
    }

    // Get redirect destination
    const headers = parseHeaders(response.headers);
    if (typeof headers.location !== "string") {
      return;
    }
    const destinationUrl = new URL(headers.location);

    // Get redirect source URL
    const sourceURL = getUrlFromOptions(request);
    if (!sourceURL) {
      return;
    }

    addRedirectToContext(sourceURL, destinationUrl, context);
  } catch {
    // Ignore, log later if we have log levels
  }
}
