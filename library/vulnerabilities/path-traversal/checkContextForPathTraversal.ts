import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractPathStringsFromUserInputCached } from "../../helpers/extractPathStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import { detectPathTraversal } from "./detectPathTraversal";

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
    return path.pathname;
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
