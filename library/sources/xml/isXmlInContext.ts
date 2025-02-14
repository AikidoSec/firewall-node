import { Context } from "../../agent/Context";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";

/**
 * Checks if the XML string can be found in the context.
 */
export function isXmlInContext(
  xml: string,
  context: Context,
  useIncludes = false
): boolean {
  for (const source of SOURCES) {
    if (source === "xml") {
      // Skip parsed XML
      continue;
    }
    const userInput = extractStringsFromUserInputCached(context, source);
    if (!userInput) {
      continue;
    }

    for (const str of userInput) {
      if (useIncludes) {
        if (str.includes(xml)) {
          return true;
        }
      } else if (str === xml) {
        return true;
      }
    }
  }

  return false;
}
