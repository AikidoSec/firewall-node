import type { Handler, MiddlewareHandler } from "hono";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import { wrapRequestBodyParsing } from "./wrapRequestBodyParsing";
import {
  PAYLOAD_TOO_DEEP_MESSAGE,
  PayloadTooDeepError,
  shouldBlockRequestForPayloadDepth,
} from "../../helpers/shouldBlockRequestForPayloadDepth";

export function wrapRequestHandler(
  handler: Handler | MiddlewareHandler
): MiddlewareHandler {
  return async (c, next) => {
    const context = contextFromRequest(c);

    return await runWithContext(context, async () => {
      if (shouldBlockRequestForPayloadDepth()) {
        return c.text(PAYLOAD_TOO_DEEP_MESSAGE, 413);
      }

      wrapRequestBodyParsing(c.req);

      try {
        return await handler(c, next);
      } catch (error) {
        if (error instanceof PayloadTooDeepError) {
          return c.text(PAYLOAD_TOO_DEEP_MESSAGE, 413);
        }
        throw error;
      }
    });
  };
}
