import type { RequestHandler } from "express";
import { METHODS } from "http";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./express/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Express implements Wrapper {
  private wrapArgs(args: unknown[]) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      // Ignore error handlers
      if (arg.length > 3) {
        return arg;
      }

      return wrapRequestHandler(arg as RequestHandler);
    });
  }

  private wrapParamArgs(args: unknown[]) {
    // Don't check the length of the arguments here
    // app.param(name, (req, res, next, value) => {...})
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as RequestHandler);
    });
  }

  wrap(hooks: Hooks) {
    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    hooks
      .addPackage("express")
      .withVersion("^4.0.0 || ^5.0.0")
      .onRequire((exports, pkgInfo) => {
        // Wrap all the functions passed to app.METHOD(...)
        // Examples:
        // app.METHOD(path, handler)
        // app.METHOD(path, middleware, handler)
        // app.METHOD(path, middleware, middleware, ..., handler)
        for (const method of expressMethodNames) {
          wrapExport(exports.Route.prototype, method, pkgInfo, {
            kind: undefined,
            modifyArgs: (args) => this.wrapArgs(args),
          });
        }

        // Wrap all the functions passed to app.use(...)
        // app.use(middleware)
        // app.use(middleware, middleware, ...)
        // app.use(path, middleware)
        // app.use(path, middleware, middleware, ...)
        wrapExport(exports.application, "use", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => this.wrapArgs(args),
        });

        // Wrap the functions passed to app.param(...)
        // app.param(name, handler)
        wrapExport(exports.application, "param", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => this.wrapParamArgs(args),
        });
      })
      .addFileInstrumentation({
        path: "lib/application.js",
        functions: [
          {
            nodeType: "FunctionAssignment",
            name: "app.use",
            modifyArgumentsObject: true,
            operationKind: undefined,
            modifyArgs: (args) => this.wrapArgs(args),
          },
          {
            nodeType: "FunctionAssignment",
            name: "app[method]",
            modifyArgumentsObject: true,
            operationKind: undefined,
            modifyArgs: (args) => this.wrapArgs(args),
          },
          {
            nodeType: "FunctionAssignment",
            name: "app.param",
            modifyArgumentsObject: false,
            operationKind: undefined,
            modifyArgs: (args) => this.wrapParamArgs(args),
          },
        ],
      });
  }
}
