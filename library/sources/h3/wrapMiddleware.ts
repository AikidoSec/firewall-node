import type { H3Event } from "h3";
import { runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";

export function wrapMiddleware(
  handler: (...args: unknown[]) => void | Promise<void>,
  h3: typeof import("h3")
): (...args: unknown[]) => void | Promise<void> {
  return async (...args) => {
    const event = getEventFromArgs(args);

    if (!event) {
      return await handler(...args);
    }

    const context = await contextFromEvent(event, h3);

    return await runWithContext(context, async () => {
      return await handler(...args);
    });
  };
}

function getEventFromArgs(args: unknown[]): H3Event | undefined {
  for (const arg of args) {
    if (
      arg &&
      typeof arg === "object" &&
      "__is_event__" in arg &&
      arg.__is_event__
    ) {
      return arg as H3Event;
    }
  }
  return undefined;
}
