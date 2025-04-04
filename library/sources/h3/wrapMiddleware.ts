import type { H3Event } from "h3";
import { runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";
import { createWrappedFunction } from "../../helpers/wrap";

export function wrapMiddleware(
  middleware: (...args: unknown[]) => void | Promise<void>,
  h3: typeof import("h3")
): (...args: unknown[]) => void | Promise<void> {
  return createWrappedFunction(middleware, (middleware) => {
    return async (...args: unknown[]) => {
      const event = getEventFromArgs(args);

      if (!event) {
        return await middleware(...args);
      }

      const context = await contextFromEvent(event, h3);

      return await runWithContext(context, async () => {
        return await middleware(...args);
      });
    };
  }) as (...args: unknown[]) => void | Promise<void>;
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
