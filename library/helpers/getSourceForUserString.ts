import { Context } from "../agent/Context";
import { Source, SOURCES } from "../agent/Source";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

export function getSourceForUserString(
  context: Context,
  str: string
): Source | undefined {
  for (const source of SOURCES) {
    if (!context[source]) {
      continue;
    }

    const userStrings = extractStringsFromUserInput(context[source]);

    if (userStrings.has(str)) {
      return source;
    }
  }

  // Check taint tracking map (for transformed user input values)
  const taintInfo = context.taintTracking?.get(str);
  if (taintInfo) {
    return taintInfo.source;
  }

  return undefined;
}
