import { runWithContext } from "../../agent/Context";
import type { FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapHandler(handler: Function): Function {
  return function wrapped() {
    if (arguments.length > 0 && !isFastifyRequest(arguments[0])) {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        arguments
      );
    }

    const context = contextFromRequest(arguments[0] as FastifyRequest);

    return runWithContext(context, () => {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        arguments
      );
    });
  };
}

function isFastifyRequest(req: unknown): req is FastifyRequest {
  return typeof req === "object";
}
