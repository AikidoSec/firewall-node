import type { Handler, MiddlewareHandler } from "hono";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: Handler | MiddlewareHandler
): MiddlewareHandler {
  return async (c, next) => {
    const context = await contextFromRequest(c);

    return await runWithContext(context, async () => {
      return await handler(c, next);
    });
  };
}
