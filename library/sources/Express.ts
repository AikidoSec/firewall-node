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
            name: "app.param",
            modifyArgumentsObject: false,
            operationKind: undefined,
            modifyArgs: (args) => this.wrapParamArgs(args),
          },
        ],
      })
      // v5 moved the router into a separate "router" npm package.
      // We grab Router from lib/express.js (not from "router" directly,
      // since that package can be used without express).
      // Router.Route exists in v5 but not in v4 — see below for v4.
      .addFileInstrumentation({
        path: "lib/express.js",
        functions: [],
        accessLocalVariables: {
          names: ["Router"],
          cb: (vars, pkgInfo) => {
            if (vars.length > 0 && vars[0] && vars[0].Route) {
              const router = vars[0];
              for (const method of expressMethodNames) {
                wrapExport(router.Route.prototype, method, pkgInfo, {
                  kind: undefined,
                  modifyArgs: (args) => this.wrapArgs(args),
                });
              }
            }
          },
        },
      })
      // v4 has its own lib/router/route.js where Route is a local variable.
      // This file doesn't exist in v5, so this is a no-op there.
      .addFileInstrumentation({
        path: "lib/router/route.js",
        functions: [],
        accessLocalVariables: {
          names: ["Route"],
          cb: (vars, pkgInfo) => {
            if (vars.length > 0 && typeof vars[0] === "function") {
              const Route = vars[0];
              for (const method of expressMethodNames) {
                wrapExport(Route.prototype, method, pkgInfo, {
                  kind: undefined,
                  modifyArgs: (args) => this.wrapArgs(args),
                });
              }
            }
          },
        },
      });
  }
}
