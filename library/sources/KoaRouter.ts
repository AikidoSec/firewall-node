/* eslint-disable prefer-rest-params */
import type { Hooks } from "../agent/hooks/Hooks";
import type { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import type { Agent } from "../agent/Agent";
import type { Middleware } from "koa";
import { wrapRouterMiddleware } from "./koa/wrapRouterMiddleware";
import { METHODS } from "http";

export class KoaRouter implements Wrapper {
  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRouterMiddleware(arg as Middleware, agent);
    });
  }

  wrap(hooks: Hooks) {
    const methods = METHODS.map((method) => method.toLowerCase());

    const methodsToWrap = ["use", "all", "param", ...methods];

    // Todo wrap koa-router (same package)
    hooks
      .addPackage("@koa/router")
      .withVersion("^13.0.0")
      .onRequire((exports, pkgInfo) => {
        return wrapNewInstance(exports, undefined, pkgInfo, (instance) => {
          for (const method of methodsToWrap) {
            wrapExport(instance, method, pkgInfo, {
              modifyArgs: this.wrapArgs,
            });
          }
        });
      });
  }
}
