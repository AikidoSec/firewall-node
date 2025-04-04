import type { EventHandler, H3Event } from "h3";
import { runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";
import { createWrappedFunction } from "../../helpers/wrap";

export function wrapEventHandler(
  handler: EventHandler,
  h3: typeof import("h3")
): EventHandler {
  return createWrappedFunction(handler, (handler) => {
    return async (event: H3Event) => {
      const context = await contextFromEvent(event, h3);

      return await runWithContext(context, async () => {
        return await handler(event);
      });
    };
  }) as EventHandler;
}
