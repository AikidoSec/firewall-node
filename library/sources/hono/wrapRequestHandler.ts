import type { Handler, MiddlewareHandler } from "hono";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import { wrapRequestBodyParsing } from "./wrapRequestBodyParsing";

export function wrapRequestHandler(
  handler: Handler | MiddlewareHandler
): MiddlewareHandler {
  return async (c, next) => {
    const context = contextFromRequest(c);

    return await runWithContext(context, async () => {
      wrapRequestBodyParsing(c.req);

      return await handler(c, next);
    });
  };
}
