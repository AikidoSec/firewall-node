import { Context } from "../agent/Context";
import { SOURCES } from "../agent/Source";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

type ReturnValue = ReturnType<typeof extractStringsFromUserInput>;

export function extractPathTraversalStringsFromUserInputCached(
  context: Context
): ReturnValue {
  if (context.cachePathTraversal) {
    return context.cachePathTraversal;
  }

  const userStrings: ReturnValue = new Set();

  for (const source of SOURCES) {
    if (!context[source]) {
      continue;
    }

    for (const item of extractStringsFromUserInput(context[source])) {
      if (item.includes("/")) {
        userStrings.add(item);
      }
    }
  }

  context.cachePathTraversal = userStrings;

  return userStrings;
}
