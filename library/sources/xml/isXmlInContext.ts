import { Context } from "../../agent/Context";
import { SOURCES } from "../../agent/Source";
import { extractStringsFromUserInput } from "../../helpers/extractStringsFromUserInput";

/**
 * Checks if the XML string can be found in the context.
 */
export function isXmlInContext(xml: string, context: Context): boolean {
  for (const source of SOURCES) {
    if (source === "xml") {
      // Skip parsed XML
      continue;
    }

    if (!context[source]) {
      continue;
    }

    const userInput = extractStringsFromUserInput(context[source]);
    if (userInput.has(xml)) {
      return true;
    }
  }

  return false;
}
