import type { Context as ElysiaContext } from "elysia";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import {
  PAYLOAD_TOO_DEEP_MESSAGE,
  shouldBlockRequestForPayloadDepth,
} from "../../helpers/shouldBlockRequestForPayloadDepth";

type ElysiaHandler = (ctx: ElysiaContext) => unknown;

export function wrapRequestHandler(handler: ElysiaHandler): ElysiaHandler {
  return async (ctx: ElysiaContext) => {
    const context = contextFromRequest(ctx);

    return await runWithContext(context, () => {
      if (shouldBlockRequestForPayloadDepth()) {
        return new Response(PAYLOAD_TOO_DEEP_MESSAGE, { status: 413 });
      }

      return handler(ctx);
    });
  };
}
