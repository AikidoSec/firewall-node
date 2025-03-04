/* eslint-disable prefer-rest-params */
import type { MiddlewareHandler } from "hono";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./hono/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import type { PackageFunctionInstrumentationInstruction } from "../agent/hooks/instrumentation/types";

const METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "all",
  "on",
  "use",
] as const;

export class Hono implements Wrapper {
  // Wrap all the functions passed to hono.METHOD(...)
  // Examples:
  // hono.METHOD(path, handler)
  // hono.METHOD(path, middleware, handler)
  // hono.METHOD(path, middleware, middleware, ..., handler)
  // hono.use(middleware)
  // hono.use(middleware, middleware, ...)
  private wrapArgs(args: unknown[]) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as MiddlewareHandler);
    });
  }

  wrap(hooks: Hooks) {
    // Instrumentation instructions for the new system
    const functionsToInstrument: PackageFunctionInstrumentationInstruction[] = [
      {
        nodeType: "MethodDefinition",
        name: "addRoute",
        modifyArgs: (args) => {
          return this.wrapArgs(args);
        },
      },
    ];

    hooks
      .addPackage("hono")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        const newExports = Object.create(exports);

        wrapNewInstance(newExports, "Hono", pkgInfo, (instance) => {
          METHODS.forEach((method) => {
            wrapExport(instance, method, pkgInfo, {
              modifyArgs: this.wrapArgs,
            });
          });
        });

        return newExports;
      })
      .addFileInstrumentation({
        path: "dist/hono-base.js", //CJS has a different path
        functions: functionsToInstrument,
      })
      .addFileInstrumentation({
        path: "dist/cjs/hono-base.js",
        functions: functionsToInstrument,
      });
  }
}
