import { runWithContext } from "../../agent/Context";
import type { FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapHandler(handler: Function): Function {
  return function wrapped() {
    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);
    const request = args.length > 0 ? args[0] : undefined;

    if (!isFastifyRequest(request)) {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        args
      );
    }

    const context = contextFromRequest(request as FastifyRequest);

    return runWithContext(context, () => {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        args
      );
    });
  };
}

function isFastifyRequest(req: unknown): req is FastifyRequest {
  return typeof req === "object";
}
