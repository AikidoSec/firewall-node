import type { Lifecycle } from "@hapi/hapi";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import {
  PAYLOAD_TOO_DEEP_MESSAGE,
  shouldBlockRequestForPayloadDepth,
} from "../../helpers/shouldBlockRequestForPayloadDepth";

export function wrapRequestHandler(
  handler: Lifecycle.Method
): Lifecycle.Method {
  // oxlint-disable-next-line require-await
  return async (request, h) => {
    const context = contextFromRequest(request);

    return runWithContext(context, () => {
      if (shouldBlockRequestForPayloadDepth()) {
        return h.response(PAYLOAD_TOO_DEEP_MESSAGE).code(413).takeover();
      }

      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        [request, h]
      );
    });
  };
}
