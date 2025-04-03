import type {
  EventHandler,
  EventHandlerRequest,
  EventHandlerResponse,
} from "h3";
import { runWithContext } from "../../agent/Context";
import { contextFromEvent } from "./contextFromEvent";

export function wrapEventHandler(
  handler: EventHandler<EventHandlerRequest, EventHandlerResponse>,
  h3: typeof import("h3")
): EventHandler<EventHandlerRequest, EventHandlerResponse> {
  return async (event) => {
    const context = await contextFromEvent(event, h3);

    return await runWithContext(context, async () => {
      return await handler(event);
    });
  };
}
