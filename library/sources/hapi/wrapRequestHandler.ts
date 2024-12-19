import type { Lifecycle } from "@hapi/hapi";
import { runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: Lifecycle.Method
): Lifecycle.Method {
  return async (request, h) => {
    const context = contextFromRequest(request);

    return runWithContext(context, () => {
      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        [request, h]
      );
    });
  };
}
