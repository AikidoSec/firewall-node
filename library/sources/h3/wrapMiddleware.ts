import type { H3Event } from "h3";
import { runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";
import { createWrappedFunction } from "../../helpers/wrap";

export type H3Middleware = (...args: unknown[]) => void | Promise<void>;

export function wrapMiddleware(
  middleware: H3Middleware,
  h3: typeof import("h3")
): H3Middleware {
  return createWrappedFunction(middleware, (middleware) => {
    return async (...args: unknown[]) => {
      const event = getEventFromArgs(args);

      if (!event) {
        return await middleware(...args);
      }

      const context = contextFromEvent(event, h3);

      return await runWithContext(context, async () => {
        return await middleware(...args);
      });
    };
  }) as H3Middleware;
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
