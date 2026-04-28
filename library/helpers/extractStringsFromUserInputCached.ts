import { Context } from "../agent/Context";
import { SOURCES } from "../agent/Source";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

type ReturnValue = ReturnType<typeof extractStringsFromUserInput>;

export function extractStringsFromUserInputCached(
  context: Context
): ReturnValue {
  if (context.cache) {
    return context.cache;
  }

  const userStrings: ReturnValue = new Set();

  for (const source of SOURCES) {
    if (!context[source]) {
      continue;
    }

    for (const item of extractStringsFromUserInput(context[source])) {
      userStrings.add(item);
    }
  }

  context.cache = userStrings;

  return userStrings;
}
