import type { Context as ElysiaContext } from "elysia";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

type ElysiaHandler = (ctx: ElysiaContext) => unknown;

export function wrapRequestHandler(handler: ElysiaHandler): ElysiaHandler {
  return async (ctx: ElysiaContext) => {
    const context = contextFromRequest(ctx);

    return await runWithContext(context, () => {
      return handler(ctx);
    });
  };
}
