import type { RouteOptions } from "fastify";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapHandler } from "./fastify/wrapHandler";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { wrapExport } from "../agent/hooks/wrapExport";
import { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
import { PackageFunctionInstrumentationInstruction } from "../agent/hooks/instrumentation/types";

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
    pkgInfo: PartialWrapPackageInfo
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
    wrapExport(appInstance, method, pkgInfo, {
      kind: undefined,
      modifyArgs: this.wrapRequestArgs,
    });

    return appInstance;
  }

  private wrapFastifyInstance(instance: any, pkgInfo: PartialWrapPackageInfo) {
    for (const func of requestFunctions) {
      // Check if the function exists - new functions in Fastify 5
      if (typeof instance[func] === "function") {
        wrapExport(instance, func, pkgInfo, {
          kind: undefined,
          modifyArgs: this.wrapRequestArgs,
        });
      }
    }

    wrapExport(instance, "route", pkgInfo, {
      kind: undefined,
      modifyArgs: this.wrapRouteMethod,
    });

    wrapExport(instance, "addHook", pkgInfo, {
      kind: undefined,
      modifyArgs: this.wrapAddHookArgs,
    });

    // Added in Fastify 5
    if (typeof instance.addHttpMethod === "function") {
      wrapExport(instance, "addHttpMethod", pkgInfo, {
        kind: undefined,
        modifyReturnValue: (args, returnValue) =>
          this.wrapNewRouteMethod(args, returnValue, pkgInfo),
      });
    }
  }

  private getFunctionInstructions(): PackageFunctionInstrumentationInstruction[] {
    return [
      {
        name: "addHook",
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyArgs: this.wrapAddHookArgs,
      },
      {
        name: "addHttpMethod",
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyReturnValue: (args, returnValue) =>
          this.wrapNewRouteMethod(args, returnValue, {
            name: "fastify",
            type: "external",
          }),
      },
      {
        name: "_route",
        nodeType: "FunctionExpression",
        operationKind: undefined,
        modifyArgs: this.wrapRouteMethod,
      },
      ...requestFunctions.map(
        (func): PackageFunctionInstrumentationInstruction => ({
          name: `_${func}`,
          nodeType: "FunctionExpression",
          operationKind: undefined,
          modifyArgs: this.wrapRequestArgs,
        })
      ),
    ];
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
      })
      .addFileInstrumentation({
        path: "fastify.js",
        functions: this.getFunctionInstructions(),
      });
  }
}
