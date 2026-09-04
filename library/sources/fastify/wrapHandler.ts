import { runWithContext } from "../../agent/Context";
import type { FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";
import {
  PAYLOAD_TOO_DEEP_MESSAGE,
  shouldBlockRequestForPayloadDepth,
} from "../../helpers/shouldBlockRequestForPayloadDepth";

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
      const reply = arguments[1] as
        | {
            sent?: boolean;
            status(code: number): {
              header(
                key: string,
                value: string
              ): {
                send(payload: string): unknown;
              };
            };
          }
        | undefined;

      if (reply && !reply.sent && shouldBlockRequestForPayloadDepth()) {
        return reply
          .status(413)
          .header("Content-Type", "text/plain")
          .send(PAYLOAD_TOO_DEEP_MESSAGE);
      }

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
