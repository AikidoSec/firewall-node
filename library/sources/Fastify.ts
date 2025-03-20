import type { RouteOptions } from "fastify";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapHandler } from "./fastify/wrapHandler";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { wrapExport } from "../agent/hooks/wrapExport";
import { WrapPackageInfo } from "../agent/hooks/WrapPackageInfo";

export class Fastify implements Wrapper {
  private wrapRequestArgs(args: unknown[]) {
    return args.map((arg) => {
      if (typeof arg === "function") {
        return wrapHandler(arg);
      }

      return arg;
    });
  }

  private wrapAddHookArgs(args: unknown[]) {
    if (args.length < 2 || typeof args[0] !== "string") {
      return args;
    }

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

    const hookName = args[0] as string;

    if (!hooksToWrap.includes(hookName)) {
      return args;
    }

    return args.map((arg) => {
      if (typeof arg === "function") {
        return wrapHandler(arg);
      }

      return arg;
    });
  }

  private wrapRouteMethod(args: unknown[]) {
    if (args.length < 1) {
      return args;
    }

    const options = args[0] as RouteOptions;

    if (!isPlainObject(options)) {
      return args;
    }

    for (const [key, value] of Object.entries(options)) {
      if (typeof value === "function") {
        options[key] = wrapHandler(value);
      }
    }

    return args;
  }

  /**
   * Wrap a new route method that was added by using `addHttpMethod`
   */
  private wrapNewRouteMethod(
    args: unknown[],
    appInstance: any,
    pkgInfo: WrapPackageInfo
  ) {
    if (
      !args.length ||
      typeof args[0] !== "string" ||
      !appInstance ||
      typeof appInstance !== "object"
    ) {
      return appInstance;
    }

    const method = args[0].toLowerCase();
    if (typeof appInstance[method] !== "function") {
      return appInstance;
    }

    // Wrap the new route method
    wrapExport(
      appInstance,
      method,
      pkgInfo,
      {
        modifyArgs: this.wrapRequestArgs,
      },
      undefined
    );

    return appInstance;
  }

  private wrapFastifyInstance(instance: any, pkgInfo: WrapPackageInfo) {
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

    for (const func of requestFunctions) {
      // Check if the function exists - new functions in Fastify 5
      if (typeof instance[func] === "function") {
        wrapExport(
          instance,
          func,
          pkgInfo,
          {
            modifyArgs: this.wrapRequestArgs,
          },
          undefined
        );
      }
    }

    wrapExport(
      instance,
      "route",
      pkgInfo,
      {
        modifyArgs: this.wrapRouteMethod,
      },
      undefined
    );

    wrapExport(
      instance,
      "addHook",
      pkgInfo,
      {
        modifyArgs: this.wrapAddHookArgs,
      },
      undefined
    );

    // Added in Fastify 5
    if (typeof instance.addHttpMethod === "function") {
      wrapExport(
        instance,
        "addHttpMethod",
        pkgInfo,
        {
          modifyReturnValue: (args, returnValue) =>
            this.wrapNewRouteMethod(args, returnValue, pkgInfo),
        },
        undefined
      );
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("fastify")
      .withVersion("^4.0.0 || ^5.0.0")
      .onRequire((exports, pkgInfo) => {
        // Wrap export with the name "fastify"
        wrapNewInstance(exports, "fastify", pkgInfo, (exports) =>
          this.wrapFastifyInstance(exports, pkgInfo)
        );
        // Wrap export with the name "default"
        wrapNewInstance(exports, "default", pkgInfo, (exports) =>
          this.wrapFastifyInstance(exports, pkgInfo)
        );
        // Wrap default export
        return wrapNewInstance(exports, undefined, pkgInfo, (exports) =>
          this.wrapFastifyInstance(exports, pkgInfo)
        );
      });
  }
}
