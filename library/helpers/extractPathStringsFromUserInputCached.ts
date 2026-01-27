import { Context } from "../agent/Context";
import { SOURCES } from "../agent/Source";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";
import { sep } from "node:path";

type ReturnValue = ReturnType<typeof extractStringsFromUserInput>;

export function extractPathStringsFromUserInputCached(
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
      // Performance optimization: only keep strings that contain a path separator
      // as only those can be used for path traversal
      // keeps the set smaller and speeds up `fs` and `path` operations
      if (item.includes(sep)) {
        userStrings.add(item);
      }
    }
  }

  context.cachePathTraversal = userStrings;

  return userStrings;
}
