import type { EventHandler, H3Event } from "h3";
import { runWithEventContext } from "./runWithEventContext";
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
      return await runWithEventContext(event, h3, async () => {
        return await handler(event);
      });
    };
  }) as EventHandler;
}
