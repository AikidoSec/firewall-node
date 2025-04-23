import { getContext, updateContext } from "../../agent/Context";
import type { Tool } from "ai";
import { isPlainObject } from "../../helpers/isPlainObject";

export function wrapToolExecution(handler: Tool["execute"]): Tool["execute"] {
  return async function execute() {
    if (!handler || typeof handler !== "function") {
      return;
    }
    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);

    if (args && args.length > 0 && isPlainObject(args[0])) {
      const context = getContext();
      if (context) {
        if (Array.isArray(context.xml)) {
          updateContext(context, "aiToolParams", context.xml.concat(args[0]));
        } else {
          updateContext(context, "aiToolParams", [args[0]]);
        }
      }
    }

    return await handler.apply(
      // @ts-expect-error We don't now the type of `this` here
      this,
      // @ts-expect-error We don't now the passed args
      args
    );
  };
}
