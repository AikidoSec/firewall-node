import type { FastifyRequest, FastifyReply } from "fastify";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./fastify/wrapRequestHandler";

export class Fastify implements Wrapper {
  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(
        arg as (request: FastifyRequest, reply: FastifyReply) => unknown,
        agent
      );
    });
  }

  wrap(hooks: Hooks) {
    const fastify = hooks.addPackage("fastify").withVersion("^4.0.0");
    const exports = fastify.addSubject((exports) => {
      return exports;
    });

    exports
      .inspectNewInstance("fastify")
      .addSubject((exports) => exports)
      .modifyArguments("get", (args, original, agent) => {
        return this.wrapArgs(args, agent);
      });

    // Todo wrap default export
    // Todo wrap other methods
  }
}
