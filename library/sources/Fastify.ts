import type { RouteOptions, RouteHandlerMethod } from "fastify";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./fastify/wrapRequestHandler";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapHookHandler } from "./fastify/wrapHookHandler";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";

export class Fastify implements Wrapper {
  private wrapRequestArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as RouteHandlerMethod, agent);
    });
  }

  private wrapAddHookArgs(args: unknown[], agent: Agent) {
    if (args.length < 2 || typeof args[0] !== "string") {
      return args;
    }
    const hookName = args[0] as string;

    const hooksToWrap = [
      "onRequest",
      "preParsing",
      "preValidation",
      "preHandler",
      "preSerialization",
      "onError",
      "onSend",
      "onResponse",
      "onTimeout",
      "onRequestAbort",
    ];

    if (!hooksToWrap.includes(hookName)) {
      return args;
    }

    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapHookHandler(arg, agent, hookName);
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

  /**
   * Wrap a new route method that was added by using `addHttpMethod`
   */
  private wrapNewRouteMethod(
    args: unknown[],
    appInstance: any,
    agent: Agent,
    pkgInfo: WrapPackageInfo
  ) {
    if (!args.length || typeof args[0] !== "string") {
      return appInstance;
    }

    if (!appInstance || typeof appInstance !== "object") {
      return appInstance;
    }

    const method = args[0].toLowerCase();
    if (typeof appInstance[method] !== "function") {
      return appInstance;
    }

    // Wrap the new route method
    wrapExport(appInstance, method, pkgInfo, {
      modifyArgs: this.wrapRequestArgs,
    });

    return appInstance;
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
    ];

    hooks
      .addPackage("fastify")
      .withVersion("^4.0.0 || ^5.0.0")
      .onRequire((exports, pkgInfo) => {
        const onNewInstance = (instance: any) => {
          for (const func of requestFunctions) {
            // Check if the function exists
            if (typeof instance[func] !== "function") {
              continue;
            }
            wrapExport(instance, func, pkgInfo, {
              modifyArgs: this.wrapRequestArgs,
            });
          }
          wrapExport(instance, "route", pkgInfo, {
            modifyArgs: this.wrapRouteMethod,
          });
          wrapExport(instance, "addHook", pkgInfo, {
            modifyArgs: this.wrapAddHookArgs,
          });

          // Added in Fastify 5
          if (typeof instance.addHttpMethod === "function") {
            wrapExport(instance, "addHttpMethod", pkgInfo, {
              modifyReturnValue: (args, returnValue, agent) =>
                this.wrapNewRouteMethod(args, returnValue, agent, pkgInfo),
            });
          }
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
