import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
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

  for (const source of SOURCES) {
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const [str, path] of userInput.entries()) {
      if (detectPathTraversal(pathString, str, checkPathStart, isUrl)) {
        return {
          operation: operation,
          kind: "path_traversal",
          source: source,
          pathToPayload: path,
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
    } catch (e) {
      return undefined;
    }
  }

  return undefined;
}
