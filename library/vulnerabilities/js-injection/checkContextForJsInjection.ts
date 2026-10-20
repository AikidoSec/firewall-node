import { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import {
  type ZenInternalsJsSourceType,
  detectJsInjection,
} from "./detectJsInjection";

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
