import type { FastifyRequest, FastifyReply, RouteOptions } from "fastify";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./fastify/wrapRequestHandler";
import { wrapWithArgumentModification } from "../agent/applyHooks";
import { ModifyingArgumentsMethodInterceptor } from "../agent/hooks/ModifyingArgumentsInterceptor";

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

  private wrapRouteMethod(args: unknown[], agent: Agent) {
    if (args.length < 1) {
      return args;
    }
    const options = args[0] as RouteOptions;
    if (!options || typeof options !== "object") {
      return args;
    }

    for (const [key, value] of Object.entries(options)) {
      if (typeof value !== "function") {
        continue;
      }

      // @ts-expect-error types
      options[key] = wrapRequestHandler(
        value as (request: FastifyRequest, reply: FastifyReply) => unknown,
        agent
      );
    }
    return args;
  }

  wrap(hooks: Hooks) {
    const fastify = hooks.addPackage("fastify").withVersion("^4.0.0");
    const exports = fastify.addSubject((exports) => exports);
    const requireSubject = fastify.addRequireSubject();

    const requestFunctions = [
      "get",
      "head",
      "post",
      "put",
      "delete",
      "options",
      "patch",
      "all",
      "addHook",
    ];

    const instances = [
      requireSubject,
      exports.inspectNewInstance("fastify").addSubject((exports) => exports),
      exports.inspectNewInstance("default").addSubject((exports) => exports),
    ];

    for (const instance of instances) {
      for (const func of requestFunctions) {
        instance.modifyArguments(func, (args, original, agent) => {
          return this.wrapArgs(args, agent);
        });
      }

      instance.modifyArguments("route", (args, original, agent) => {
        return this.wrapRouteMethod(args, agent);
      });
    }
  }
}
