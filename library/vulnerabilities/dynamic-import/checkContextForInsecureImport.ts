import type { Context } from "../../agent/Context";
import { InterceptorResult } from "../../agent/hooks/InterceptorResult";
import { getPathsToPayload } from "../../helpers/attackPath";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../helpers/getSourceForUserString";
import { detectInsecureImport } from "./detectInsecureImport";

export function checkContextForInsecureImport({
  specifier,
  context,
}: {
  specifier: string;
  context: Context;
}): InterceptorResult {
  // Todo check with and without node: prefix
  if (specifier.startsWith("node:")) {
    specifier = specifier.slice(5);
  }

  for (const str of extractStringsFromUserInputCached(context)) {
    if (detectInsecureImport(specifier, str)) {
      const source = getSourceForUserString(context, str);

      if (source) {
        return {
          operation: "import/require",
          kind: "insecure_import",
          source: source,
          pathsToPayload: getPathsToPayload(str, context[source]),
          metadata: {
            specifier,
          },
          payload: str,
        };
      }
    }
  }
}
