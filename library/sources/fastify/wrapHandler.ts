import { runWithContext } from "../../agent/Context";
import type { FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapHandler(handler: Function): Function {
  return (...args: unknown[]) => {
    const request = args.length > 0 ? args[0] : undefined;

    if (!isFastifyRequest(request)) {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        args
      );
    }

    const context = contextFromRequest(request as FastifyRequest);

    return runWithContext(context, () => {
      return handler.apply(
        // @ts-expect-error We don't know the type of this
        this,
        args
      );
    });
  };
}

function isFastifyRequest(req: unknown): req is FastifyRequest {
  return typeof req === "object";
}
