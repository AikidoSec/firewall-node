import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapEventHandler } from "./h3/wrapEventHandler";
import type { EventHandler } from "h3";
import { wrapReadBody } from "./h3/wrapReadBody";
import { type H3Middleware, wrapMiddleware } from "./h3/wrapMiddleware";
import { isPlainObject } from "../helpers/isPlainObject";
import {
  LocalVariableAccessConfig,
  PackageFunctionInstrumentationInstruction,
} from "../agent/hooks/instrumentation/types";

export type PartialH3Exports = Pick<
  typeof import("h3"),
  "getHeaders" | "getRequestURL" | "getQuery" | "parseCookies"
>;

const bodyFuncs = [
  "readBody",
  "readFormData",
  "readMultipartFormData",
  "readRawBody",
  "readValidatedBody",
];

export class H3 implements Wrapper {
  private h3Exports: PartialH3Exports | undefined;

  private setH3Exports(exports: Record<keyof PartialH3Exports, unknown>) {
    if (Object.values(exports).some((v) => typeof v !== "function")) {
      this.h3Exports = undefined;
      return;
    }
    this.h3Exports = exports as PartialH3Exports;
  }

  private wrapEventHandler(args: unknown[]) {
    const h3 = this.h3Exports;
    if (args.length === 0 || !h3) {
      return args;
    }

    if (typeof args[0] === "function") {
      return [wrapEventHandler(args[0] as EventHandler, h3)];
    }

    if (isPlainObject(args[0])) {
      const config = args[0] as { [key: string]: unknown };

      if ("handler" in config && typeof config.handler === "function") {
        config.handler = wrapEventHandler(config.handler as EventHandler, h3);
      }

      const middlewareFuncs = ["onRequest", "onBeforeResponse"];
      for (const func of middlewareFuncs) {
        if (func in config) {
          // Can be a function or an array of functions
          if (typeof config[func] === "function") {
            config[func] = wrapMiddleware(config[func] as H3Middleware, h3);
          } else if (Array.isArray(config[func])) {
            config[func] = (config[func] as H3Middleware[]).map((m) =>
              wrapMiddleware(m, h3)
            );
          }
        }
      }
    }

    return args;
  }

  private wrapCreateApp(args: unknown[]) {
    const h3 = this.h3Exports;
    if (args.length === 0 || !isPlainObject(args[0]) || !h3) {
      return args;
    }

    const config = args[0] as { [key: string]: unknown };
    const funcs = [
      "onRequest",
      "onBeforeResponse",
      "onAfterResponse",
      "onError",
    ];

    for (const func of funcs) {
      if (func in config && typeof config[func] === "function") {
        config[func] = wrapMiddleware(config[func] as H3Middleware, h3);
      }
    }

    return args;
  }

  private wrapFromFunction(returnValue: unknown) {
    const h3 = this.h3Exports;
    if (typeof returnValue !== "function" || !h3) {
      return returnValue;
    }
    return wrapEventHandler(returnValue as EventHandler, h3);
  }

  private getFunctionInstructions(): PackageFunctionInstrumentationInstruction[] {
    const bodyInstructions = bodyFuncs.map((func) => {
      return {
        name: func,
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyReturnValue: wrapReadBody,
      } satisfies PackageFunctionInstrumentationInstruction;
    });

    return [
      {
        name: "defineEventHandler",
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyArgs: (args) => {
          return this.wrapEventHandler(args);
        },
      },
      {
        name: "createApp",
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyArgs: (args) => {
          return this.wrapCreateApp(args);
        },
      },
      {
        name: "fromNodeMiddleware",
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyReturnValue: (_args, returnValue) => {
          return this.wrapFromFunction(returnValue);
        },
      },
      {
        name: "fromWebHandler",
        nodeType: "FunctionDeclaration",
        operationKind: undefined,
        modifyReturnValue: (_args, returnValue) => {
          return this.wrapFromFunction(returnValue);
        },
      },
      ...bodyInstructions,
    ];
  }

  private getLocalVariableAccessConfig(): LocalVariableAccessConfig {
    return {
      names: ["getHeaders", "getRequestURL", "getQuery", "parseCookies"],
      cb: (localVars) => {
        const [getHeaders, getRequestURL, getQuery, parseCookies] = localVars;
        this.setH3Exports({
          getHeaders,
          getRequestURL,
          getQuery,
          parseCookies,
        });
      },
    };
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("h3")
      .withVersion("^1.8.0")
      .onRequire((exports, pkgInfo) => {
        this.setH3Exports({
          getHeaders: exports.getHeaders,
          getRequestURL: exports.getRequestURL,
          getQuery: exports.getQuery,
          parseCookies: exports.parseCookies,
        });

        wrapExport(exports, "defineEventHandler", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => {
            return this.wrapEventHandler(args);
          },
        });

        wrapExport(exports, "createApp", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => {
            return this.wrapCreateApp(args);
          },
        });

        wrapExport(exports, "fromNodeMiddleware", pkgInfo, {
          kind: undefined,
          modifyReturnValue: (_args, returnValue) => {
            return this.wrapFromFunction(returnValue);
          },
        });

        wrapExport(exports, "fromWebHandler", pkgInfo, {
          kind: undefined,
          modifyReturnValue: (_args, returnValue) => {
            return this.wrapFromFunction(returnValue);
          },
        });

        for (const func of bodyFuncs) {
          wrapExport(exports, func, pkgInfo, {
            kind: undefined,
            modifyReturnValue: wrapReadBody,
          });
        }
      })
      .addFileInstrumentation({
        path: "dist/index.mjs",
        functions: this.getFunctionInstructions(),
        accessLocalVariables: this.getLocalVariableAccessConfig(),
      })
      .addFileInstrumentation({
        path: "dist/index.cjs",
        functions: this.getFunctionInstructions(),
        accessLocalVariables: this.getLocalVariableAccessConfig(),
      });
  }
}
