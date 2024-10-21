import { runWithContext } from "../../agent/Context";
import type { FastifyReply, FastifyRequest } from "fastify";
import { contextFromRequest } from "./contextFromRequest";

export function wrapRequestHandler(
  handler: (request: FastifyRequest, reply: FastifyReply) => unknown
): unknown {
  return (request: FastifyRequest, reply: FastifyReply) => {
    const context = contextFromRequest(request);

    return runWithContext(context, () => {
      return handler(request, reply);
    });
  };
}
