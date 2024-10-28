import type { Hooks } from "../agent/hooks/Hooks";
import type { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { wrapMiddleware } from "./koa/wrapMiddleware";
import type { Middleware } from "koa";
import { isDeprecatedGenerator } from "./koa/isDeprecatedGenerator";

export class Koa implements Wrapper {
  private wrapUseArgs(args: unknown[]) {
    if (typeof args[0] === "function") {
      // Check if the middleware is a generator function
      // We cant wrap them like normal functions, but they are already deprecated for a while and will be completely removed in koa v3
      if (!isDeprecatedGenerator(args[0])) {
        args[0] = wrapMiddleware(args[0] as Middleware);
      }
    }

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("koa")
      .withVersion("^2.0.0")
      .onRequire((exports, pkgInfo) => {
        return wrapNewInstance(exports, undefined, pkgInfo, (instance) => {
          wrapExport(instance, "use", pkgInfo, {
            modifyArgs: this.wrapUseArgs,
          });
        });
      });
  }
}
