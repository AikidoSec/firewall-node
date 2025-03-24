import type { RequestHandler } from "express";
import { METHODS } from "http";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./express/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Express implements Wrapper {
  // Wrap all the functions passed to app.METHOD(...)
  // Examples:
  // app.METHOD(path, handler)
  // app.METHOD(path, middleware, handler)
  // app.METHOD(path, middleware, middleware, ..., handler)
  // Wrap all the functions passed to app.use(...)
  // app.use(middleware)
  // app.use(middleware, middleware, ...)
  // app.use(path, middleware)
  // app.use(path, middleware, middleware, ...)
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

  wrap(hooks: Hooks) {
    const expressMethodNames = METHODS.map((method) => method.toLowerCase());

    hooks
      .addPackage("express")
      .withVersion("^4.0.0 || ^5.0.0")
      .onRequire((exports, pkgInfo) => {
        for (const method of expressMethodNames) {
          wrapExport(exports.Route.prototype, method, pkgInfo, {
            modifyArgs: (args, agent) => this.wrapArgs(args, agent),
          });
        }

        wrapExport(exports.application, "use", pkgInfo, {
          modifyArgs: (args, agent) => this.wrapArgs(args, agent),
        });
      });
  }
}
