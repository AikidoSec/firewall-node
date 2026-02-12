import { shouldBlockRequest } from "./shouldBlockRequest";
import { escapeHTML } from "../helpers/escapeHTML";
/** TS_EXPECT_TYPES_ERROR_OPTIONAL_DEPENDENCY **/
import type { FastifyInstance } from "fastify";

export type FastifyReply = {
  status(code: number): FastifyReply;
  send(payload: string): FastifyReply;
};

export type FastifyDone = () => void;

// Can't use `any` because it might cause issues with type checking
// e.g. if `skipLibChecks` is false
export type FastifyRequest = {};

// Can't use `onRequestHookHandler` type from fastify because it uses `import("fastify")` in the type,
// replacing TS_EXPECT_TYPES_ERROR_OPTIONAL_DEPENDENCY isn't enough
export type FastifyHookHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
  done: FastifyDone
) => void | FastifyReply;

/**
 * Calling this function will setup rate limiting and user blocking for the provided Fastify app by adding a onRequest hook.
 * Attacks will still be blocked by Zen if you do not call this function.
 * Execute this function as early as possible in your Fastify app, but after the hook that sets the user.
 */
export function addFastifyHook(app: FastifyInstance) {
  app.addHook("onRequest", fastifyHook);
}

export const fastifyHook: FastifyHookHandler = (_, reply, done) => {
  const result = shouldBlockRequest();

  if (result.block) {
    if (result.type === "ratelimited") {
      let message = "You are rate limited by Zen.";
      if (result.trigger === "ip" && result.ip) {
        message += ` (Your IP: ${escapeHTML(result.ip)})`;
      }

      return reply.status(429).send(message);
    }

    if (result.type === "blocked") {
      return reply.status(403).send("You are blocked by Aikido firewall.");
    }
  }

  done();
};
