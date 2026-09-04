import { contextFromRequest } from "./contextFromRequest";
import { runWithContext } from "../../agent/Context";
import type { Middleware, Context as KoaContext } from "koa";
import {
  PAYLOAD_TOO_DEEP_MESSAGE,
  shouldBlockRequestForPayloadDepth,
} from "../../helpers/shouldBlockRequestForPayloadDepth";

export function wrapMiddleware(origMiddleware: Middleware): Middleware {
  return function wrapped() {
    const applyOriginal = () => {
      return origMiddleware.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // @ts-expect-error We don't know the type of arguments
        arguments
      );
    };

    const args = Array.from(arguments);
    if (
      typeof args[0] !== "object" ||
      Array.isArray(args[0]) ||
      args[0] === null
    ) {
      return applyOriginal();
    }

    const ctx = args[0] as KoaContext;
    const context = contextFromRequest(ctx);

    return runWithContext(context, () => {
      if (shouldBlockRequestForPayloadDepth()) {
        ctx.type = "text/plain";
        ctx.body = PAYLOAD_TOO_DEEP_MESSAGE;
        ctx.status = 413;
        return;
      }

      return applyOriginal();
    });
  };
}
