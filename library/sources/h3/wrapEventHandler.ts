import type { EventHandler, H3Event } from "h3";
import { runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";
import { createWrappedFunction } from "../../helpers/wrap";
import type { PartialH3Exports } from "../H3";

export function wrapEventHandler(
  handler: EventHandler,
  h3: PartialH3Exports | undefined
): EventHandler {
  if (!h3) {
    return handler;
  }

  return createWrappedFunction(handler, (handler) => {
    return async (event: H3Event) => {
      const context = contextFromEvent(event, h3);

      return await runWithContext(context, async () => {
        return await handler(event);
      });
    };
  }) as EventHandler;
}
