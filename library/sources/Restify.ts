import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./restify/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";

export class Restify implements Wrapper {
  private wrapArgs(args: unknown[]) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      // Ignore error handlers (functions with more than 3 parameters)
      if (arg.length > 3) {
        return arg;
      }

      return wrapRequestHandler(arg as Function);
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("restify")
      .withVersion("^8.0.0")
      .onFileRequire("lib/server.js", (exports, pkgInfo) => {
        // See https://restify.com/docs/server-api/
        // We don't need to wrap `server.param(...)` because it uses `server.use(...)` internally
        // We don't wrap `server.pre(...)` because it's used to modify the request before it reaches the handlers
        for (const method of [
          "get",
          "head",
          "post",
          "put",
          "patch",
          "del",
          "opts",
        ]) {
          wrapExport(exports.prototype, method, pkgInfo, {
            kind: undefined,
            modifyArgs: (args) => this.wrapArgs(args),
          });
        }

        wrapExport(exports.prototype, "use", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => this.wrapArgs(args),
        });
      });
  }
}
