import type { Lifecycle } from "@hapi/hapi";
import { getContext, runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: Lifecycle.Method
): Lifecycle.Method {
  return async (request, h) => {
    const context = contextFromRequest(request);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return handler.apply(
          // @ts-expect-error We don't now the type of this
          this,
          [request, h]
        );
      }

      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        [request, h]
      );
    });
  };
}
