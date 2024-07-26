import { Context } from "../agent/Context";
import { Source } from "../agent/Source";
import { extractStringsFromUserInput } from "./extractStringsFromUserInput";

export function extractStringsFromUserInputCached(
  context: Context,
  source: Source
): ReturnType<typeof extractStringsFromUserInput> | undefined {
  if (!context[source]) {
    return undefined;
  }

  if (!context.cache) {
    context.cache = new Map();
  }

  let result = context.cache.get(source);

  if (!result) {
    result = extractStringsFromUserInput(context[source]);
    context.cache.set(source, result);
  }

  return result;
}
