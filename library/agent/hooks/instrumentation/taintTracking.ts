import { getContext, type Context } from "../../Context";
import { extractStringsFromUserInputCached } from "../../../helpers/extractStringsFromUserInputCached";
import { getSourceForUserString } from "../../../helpers/getSourceForUserString";
import type { Source } from "../../Source";

/**
 * Runtime hook injected into user code to track tainted value transformations.
 *
 * When user code transforms a value that originated from user input (e.g. req.query),
 * the original value is in the context's cache Set. After transformation, the new value
 * wouldn't be in the set, so sinks can't detect attacks using it.
 *
 * This hook checks if the subject of a method call is a known user input,
 * and if so, adds the result to the cache so sinks can check it too.
 *
 * Example transformation by the code transformer:
 *   name.replace("'", "")
 *   → __zen_wrapMethodCallResult(name, (__a) => __a.replace("'", ""))
 */
export function __zen_wrapMethodCallResult(
  subject: unknown,
  fn: (subject: unknown) => unknown
): unknown {
  // Always execute the method — never break user code
  const result = fn(subject);

  try {
    const context = getContext() as Context | undefined;
    if (!context) {
      return result;
    }

    const cache = extractStringsFromUserInputCached(context);

    if (typeof subject === "string" && subject.length > 0) {
      if (cache.has(subject)) {
        const sourceInfo = resolveSource(context, subject);
        if (sourceInfo) {
          trackResult(context, cache, result, sourceInfo);
        }
      }
    } else if (Array.isArray(subject)) {
      // For array subjects (e.g. .reverse() or .join() on a split result)
      const sourceInfo = findArraySourceInfo(context, subject, cache);
      if (sourceInfo) {
        trackResult(context, cache, result, sourceInfo);
      }
    }
  } catch {
    // Never break user code due to taint tracking errors
  }

  return result;
}

/**
 * Find the source and original payload for a string value.
 * Checks the taint tracking map first (cheap), then falls back to source lookup.
 */
function resolveSource(
  context: Context,
  str: string
): { source: Source; payload: string } | undefined {
  // Check taint tracking map first (handles chain propagation cheaply)
  const tracked = context.taintTracking?.get(str);
  if (tracked) {
    return tracked;
  }

  // Fall back to regular source lookup (first value in a chain)
  const source = getSourceForUserString(context, str);
  if (source) {
    return { source, payload: str };
  }

  return undefined;
}

/**
 * Check if any string element in the array is tainted.
 * Returns the source info for the first tainted element found.
 */
function findArraySourceInfo(
  context: Context,
  arr: unknown[],
  cache: Set<string>
): { source: Source; payload: string } | undefined {
  for (const item of arr) {
    if (typeof item === "string" && item.length > 0 && cache.has(item)) {
      return resolveSource(context, item);
    }
  }
  return undefined;
}

function trackResult(
  context: Context,
  cache: Set<string>,
  result: unknown,
  sourceInfo: { source: Source; payload: string }
): void {
  if (typeof result === "string" && result.length > 0) {
    cache.add(result);
    addToTaintTracking(context, result, sourceInfo);
    return;
  }

  if (Array.isArray(result)) {
    for (const item of result) {
      if (typeof item === "string" && item.length > 0) {
        cache.add(item);
        addToTaintTracking(context, item, sourceInfo);
      }
    }
  }
}

function addToTaintTracking(
  context: Context,
  value: string,
  sourceInfo: { source: Source; payload: string }
): void {
  if (!context.taintTracking) {
    context.taintTracking = new Map();
  }
  context.taintTracking.set(value, sourceInfo);
}

/**
 * Runtime hook injected into user code to track tainted value through concatenation.
 *
 * Handles:
 *   a + b          → __zen_wrapConcat(a, b)
 *   a += b         → a = __zen_wrapConcat(a, b)
 *   str.concat(…)  → __zen_wrapConcat(str, a, b, …)
 *
 * Checks every argument: if any is a known user input, the string result is tracked.
 */
export function __zen_wrapConcat(...args: unknown[]): unknown {
  // Compute the concatenation result using + to preserve JS semantics
  let result: unknown = args[0];
  for (let i = 1; i < args.length; i++) {
    result = (result as any) + (args[i] as any);
  }

  try {
    if (typeof result !== "string" || result.length === 0) {
      return result;
    }

    const context = getContext() as Context | undefined;
    if (!context) {
      return result;
    }

    const cache = extractStringsFromUserInputCached(context);

    // Check if any argument is tainted
    for (const arg of args) {
      if (typeof arg === "string" && arg.length > 0 && cache.has(arg)) {
        const sourceInfo = resolveSource(context, arg);
        if (sourceInfo) {
          cache.add(result);
          addToTaintTracking(context, result, sourceInfo);
          return result;
        }
      }
    }
  } catch {
    // Never break user code due to taint tracking errors
  }

  return result;
}
