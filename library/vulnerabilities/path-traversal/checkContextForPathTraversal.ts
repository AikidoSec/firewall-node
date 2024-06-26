import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/MethodInterceptor";
import { Source } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";
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
  filename: string;
  operation: string;
  context: Context;
  checkPathStart?: boolean;
}): InterceptorResult {
  for (const source of [
    "body",
    "query",
    "headers",
    "cookies",
    "routeParams",
    "graphql",
    "xml",
    "subdomains",
  ] as Source[]) {
    if (context[source]) {
      const userInput = extractStringsFromUserInput(context[source]);
      for (const [str, path] of userInput.entries()) {
        if (detectPathTraversal(filename, str, checkPathStart)) {
          return {
            operation: operation,
            kind: "path_traversal",
            source: source,
            pathToPayload: path,
            metadata: {
              filename: filename,
            },
            payload: str,
          };
        }
      }
    }
  }
}
