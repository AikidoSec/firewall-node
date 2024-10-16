/* eslint-disable prefer-rest-params */
import type { MiddlewareHandler } from "hono";
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./hono/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Hono implements Wrapper {
  // Wrap all the functions passed to hono.METHOD(...)
  // Examples:
  // hono.METHOD(path, handler)
  // hono.METHOD(path, middleware, handler)
  // hono.METHOD(path, middleware, middleware, ..., handler)
  // hono.use(middleware)
  // hono.use(middleware, middleware, ...)
  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(arg as MiddlewareHandler, agent);
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("hono")
      .withVersion("^4.0.0")
      .onFileRequire("dist/hono-base.js", (exports, pkgInfo) => {
        wrapExport(exports.HonoBase.prototype, "addRoute", pkgInfo, {
          modifyArgs: (args, agent) => this.wrapArgs(args, agent),
        });
      })
      .onFileRequire("dist/cjs/hono-base.js", (exports, pkgInfo) => {
        wrapExport(exports.HonoBase.prototype, "addRoute", pkgInfo, {
          modifyArgs: (args, agent) => this.wrapArgs(args, agent),
        });
      });
  }
}
