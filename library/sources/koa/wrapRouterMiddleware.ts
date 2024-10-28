import type { Middleware, Context as KoaContext } from "koa";
import { getContext, updateContext } from "../../agent/Context";

export function wrapRouterMiddleware(origMiddleware: Middleware): Middleware {
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

    // Context is already set by Koa wrapper, so context should be available
    const context = getContext();
    /* c8 ignore next 3 */
    if (!context) {
      return applyOriginal();
    }

    const ctx = args[0] as KoaContext;
    if (ctx.params) {
      updateContext(context, "routeParams", ctx.params);
    }

    return applyOriginal();
  };
}
