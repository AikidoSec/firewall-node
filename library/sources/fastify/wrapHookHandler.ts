import { runWithContext } from "../../agent/Context";
import type { FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapHookHandler(origHandler: Function): unknown {
  return function wrap() {
    // Execute the original handler
    const applyOriginal = () => {
      return origHandler.apply(
        // @ts-expect-error We don't know the type of `this`
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };

    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);
    if (args.length < 2 || typeof args[0] !== "object") {
      return applyOriginal();
    }

    const context = contextFromRequest(args[0] as FastifyRequest);

    return runWithContext(context, () => {
      return applyOriginal();
    });
  };
}
