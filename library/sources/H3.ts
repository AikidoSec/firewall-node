import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapEventHandler } from "./h3/wrapEventHandler";
import type { EventHandler } from "h3";
import { wrapReadBody } from "./h3/wrapReadBody";
import { wrapMiddleware } from "./h3/wrapMiddleware";

export class H3 implements Wrapper {
  private wrapEventHandler(args: unknown[], h3: typeof import("h3")) {
    if (args.length < 1) {
      return args;
    }

    if (typeof args[0] === "function") {
      return [wrapEventHandler(args[0] as EventHandler, h3)];
    }

    if (args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      const config = args[0] as { [key: string]: unknown };

      if ("handler" in config && typeof config.handler === "function") {
        config.handler = wrapEventHandler(config.handler as EventHandler, h3);
      }

      const middlewareFuncs = ["onRequest", "onBeforeResponse"];
      for (const func of middlewareFuncs) {
        if (func in config) {
          // Can be a function or a  array of functions
          if (typeof config[func] === "function") {
            config[func] = wrapMiddleware(
              config[func] as (...args: unknown[]) => void | Promise<void>,
              h3
            );
          } else if (Array.isArray(config[func])) {
            config[func] = (
              config[func] as ((...args: unknown[]) => void | Promise<void>)[]
            ).map((m) =>
              wrapMiddleware(
                m as (...args: unknown[]) => void | Promise<void>,
                h3
              )
            );
          }
        }
      }
    }
    return args;
  }

  private wrapCreateApp(args: unknown[], h3: typeof import("h3")) {
    if (args.length < 1 || typeof args[0] !== "object" || !args[0]) {
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
        config[func] = wrapMiddleware(
          config[func] as (...args: unknown[]) => void | Promise<void>,
          h3
        );
      }
    }

    return args;
  }

  private wrapFromFunction(returnValue: unknown, h3: typeof import("h3")) {
    if (typeof returnValue === "function") {
      return wrapEventHandler(returnValue as EventHandler, h3);
    }

    return returnValue;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("h3")
      .withVersion("^1.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapExport(exports, "defineEventHandler", pkgInfo, {
          modifyArgs: (args) => {
            return this.wrapEventHandler(args, exports);
          },
        });

        wrapExport(exports, "createApp", pkgInfo, {
          modifyArgs: (args) => {
            return this.wrapCreateApp(args, exports);
          },
        });

        wrapExport(exports, "fromNodeMiddleware", pkgInfo, {
          modifyReturnValue: (_args, returnValue) => {
            return this.wrapFromFunction(returnValue, exports);
          },
        });

        wrapExport(exports, "fromWebHandler", pkgInfo, {
          modifyReturnValue: (_args, returnValue) => {
            return this.wrapFromFunction(returnValue, exports);
          },
        });

        const bodyFuncs = [
          "readBody",
          "readFormData",
          "readMultipartFormData",
          "readRawBody",
          "readValidatedBody",
        ];
        for (const func of bodyFuncs) {
          wrapExport(exports, func, pkgInfo, {
            modifyReturnValue: wrapReadBody,
          });
        }
      });
  }
}
