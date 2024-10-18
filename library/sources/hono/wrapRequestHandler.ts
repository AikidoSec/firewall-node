import type { Handler, MiddlewareHandler } from "hono";
import { Agent } from "../../agent/Agent";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: Handler | MiddlewareHandler,
  agent: Agent
): MiddlewareHandler {
  return async (c, next) => {
    const context = await contextFromRequest(c);

    return await runWithContext(context, async () => {
      return await handler(c, next);
    });
  };
}
