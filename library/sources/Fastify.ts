import type { RouteOptions, RouteHandlerMethod } from "fastify";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./fastify/wrapRequestHandler";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Fastify implements Wrapper {
  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as RouteHandlerMethod, agent);
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
      options[key] = wrapRequestHandler(value as RouteHandlerMethod, agent);
    }
    return args;
  }

  wrap(hooks: Hooks) {
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

    hooks
      .addPackage("fastify")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        const onNewInstance = (instance: any) => {
          for (const func of requestFunctions) {
            wrapExport(instance, func, pkgInfo, {
              modifyArgs: this.wrapArgs,
            });
          }
          wrapExport(instance, "route", pkgInfo, {
            modifyArgs: this.wrapRouteMethod,
          });
        };

        // Wrap export with the name "fastify"
        wrapNewInstance(exports, "fastify", pkgInfo, onNewInstance);
        // Wrap export with the name "default"
        wrapNewInstance(exports, "default", pkgInfo, onNewInstance);
        // Wrap default export
        return wrapNewInstance(exports, undefined, pkgInfo, onNewInstance);
      });
  }
}
