import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import { detectJsInjection } from "./detectJsInjection";

type ZenInternalsJsSourceType =
  | 0 // js (auto-detect CJS or ESM)
  | 1 // ts (TypeScript)
  | 2 // cjs (CommonJS)
  | 3 // mjs (ESM)
  | 4; // tsx (TypeScript with JSX)

/**
 * This function goes over all the different input types in the context and checks
 * if it's a possible JS Injection, if so the function returns an InterceptorResult
 */
export function checkContextForJsInjection({
  js,
  operation,
  context,
  sourceType,
}: {
  js: string;
  operation: string;
  context: Context;
  sourceType?: ZenInternalsJsSourceType;
}): InterceptorResult {
  for (const str of extractStringsFromUserInputCached(context)) {
    if (detectJsInjection(js, str, sourceType)) {
      const source = getSourceForUserString(context, str);
      if (source) {
        return {
          operation: operation,
          kind: "code_injection",
          source: source,
          pathsToPayload: getPathsToPayload(str, context[source]),
          metadata: {
            language: "js",
            code: js,
          },
          payload: str,
        };
      }
    }
  }
}
