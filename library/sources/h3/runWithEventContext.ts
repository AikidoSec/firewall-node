import type { H3Event } from "h3";
import { Context, getContext, runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";
import type { PartialH3Exports } from "../H3";

const ownerEventByContext = new WeakMap<Context, H3Event>();

/**
 * Nitro's $fetch (localFetch) runs the h3 app again with a synthetic unenv IncomingMessage,
 * inside the context of the outer request. That context holds the real user input,
 * so a sub-request must not overwrite it.
 *
 * Presets like aws-lambda also send the top-level request as a synthetic IncomingMessage,
 * so only an event other than the one that owns the context counts as a sub-request.
 *
 * Nitro sets `__unenv__` to undefined for a plain $fetch, so check with `in`.
 */
export function isNitroSubRequest(context: Context, event: H3Event): boolean {
  const ownerEvent = ownerEventByContext.get(context);

  return (
    ownerEvent !== undefined &&
    ownerEvent !== event &&
    "__unenv__" in event.node.req
  );
}

export function runWithEventContext<T>(
  event: H3Event,
  h3: PartialH3Exports,
  fn: () => T
): T {
  const existingContext = getContext();

  if (existingContext && isNitroSubRequest(existingContext, event)) {
    return fn();
  }

  const context = contextFromEvent(event, h3);

  // runWithContext updates the existing context in place if there is one
  ownerEventByContext.set(existingContext ?? context, event);

  return runWithContext(context, fn);
}
