import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractPathStringsFromUserInputCached } from "../../helpers/extractPathStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import { detectPathTraversal } from "./detectPathTraversal";
import { fileURLToPath } from "url";

/**
 * This function goes over all the different input types in the context and checks
 * if it possibly implies Path Traversal, if so the function returns an InterceptorResult
 */
export function checkContextForPathTraversal({
  filename,
  operation,
  context,
  checkPathStart = true,
}: {
  filename: string | URL | Buffer;
  operation: string;
  context: Context;
  checkPathStart?: boolean;
}): InterceptorResult {
  const isUrl = filename instanceof URL;
  const pathString = pathToString(filename);
  if (!pathString) {
    return;
  }

  for (const str of extractPathStringsFromUserInputCached(context)) {
    if (detectPathTraversal(pathString, str, checkPathStart, isUrl)) {
      const source = getSourceForUserString(context, str);
      if (source) {
        return {
          operation: operation,
          kind: "path_traversal",
          source: source,
          pathsToPayload: getPathsToPayload(str, context[source]),
          metadata: {
            filename: pathString,
          },
          payload: str,
        };
      }
    }
  }
}

/**
 * Convert a fs path argument (string, Buffer, URL) to a string
 */
function pathToString(path: string | Buffer | URL): string | undefined {
  if (typeof path === "string") {
    return path;
  }

  if (path instanceof URL) {
    // Use fileURLToPath to get the actual filesystem path that will be used.
    // This is critical for security: URL.pathname returns a path where encoded
    // dot-segments like %2e%2e have been resolved by WHATWG URL parsing, but
    // other percent-encoded characters remain encoded. For example,
    // new URL("file:///public/%2e%2e/%65tc/passwd").pathname returns
    // "/%65tc/passwd" (the %2e%2e traversal has moved up from /public/, but
    // %65 remains encoded). The filesystem API uses fileURLToPath() which
    // decodes all percent-encoding, producing "/etc/passwd". We must use the
    // same decoding here so the detector sees the actual path that will be
    // accessed, not the partially-encoded pathname.
    try {
      return fileURLToPath(path);
    } catch {
      // If fileURLToPath fails (e.g., non-file URL), fall back to pathname
      return path.pathname;
    }
  }

  if (path instanceof Buffer) {
    try {
      return new TextDecoder("utf-8", {
        fatal: true,
      }).decode(path);
    } catch {
      return undefined;
    }
  }

  return undefined;
}
