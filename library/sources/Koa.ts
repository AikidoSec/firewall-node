import type { Hooks } from "../agent/hooks/Hooks";
import type { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { wrapMiddleware } from "./koa/wrapMiddleware";
import type { Middleware } from "koa";
import { isDeprecatedGenerator } from "./koa/isDeprecatedGenerator";
import type * as KoaRouter from "@koa/router";

export class Koa implements Wrapper {
  private wrapUseArgs(args: unknown[]) {
    if (typeof args[0] === "function") {
      // Check if the middleware is a generator function
      // We cant wrap them like normal functions, but they are already deprecated for a while and will be completely removed in koa v3
      if (!isDeprecatedGenerator(args[0])) {
        // If it's a router (@koa/router or koa-router), we need to wrap all the middleware in the router
        // Wrapping .use directly breaks the router
        if ("router" in args[0] && args[0].router) {
          const router = args[0].router as KoaRouter;
          const routesStack = router.stack ?? [];
          for (const pathLayer of routesStack) {
            const pathStack = pathLayer.stack;
            for (let i = 0; i < pathStack.length; i++) {
              pathStack[i] = wrapMiddleware(pathStack[i] as Middleware);
            }
          }
        } else {
          args[0] = wrapMiddleware(args[0] as Middleware);
        }
      }
    }

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("koa")
      .withVersion("^3.0.0 || ^2.0.0")
      .onRequire((exports, pkgInfo) => {
        return wrapNewInstance(exports, undefined, pkgInfo, (instance) => {
          wrapExport(instance, "use", pkgInfo, {
            kind: undefined,
            modifyArgs: this.wrapUseArgs,
          });
        });
      })
      .addFileInstrumentation({
        path: "lib/application.js",
        functions: [
          {
            name: "use",
            nodeType: "MethodDefinition",
            operationKind: undefined,
            modifyArgs: (args) => this.wrapUseArgs(args),
          },
        ],
      });
  }
}
