import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./elysia/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";

const METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "options",
  "patch",
  "all",
  "on",
  // Include lifecycle hooks so middleware added via onBeforeHandle gets context
  "onBeforeHandle",
] as const;

export class Elysia implements Wrapper {
  private wrapArgs(args: unknown[]) {
    return args.map((arg) => {
      if (typeof arg !== "function") {
        return arg;
      }

      return wrapRequestHandler(
        arg as Parameters<typeof wrapRequestHandler>[0]
      );
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("elysia")
      .withVersion("^1.4.0")
      .onRequire((exports, pkgInfo) => {
        const newExports = Object.create(exports);

        // Elysia's CJS bundle defines lazy getters for all exports
        // Accessing exports.Elysia during module initialization (which happens during
        // circular dependency loading) does not work.
        //
        // We define a lazy getter on newExports.Elysia so prototype wrapping is
        // deferred until the first time user code accesses the class.

        let instrumented = false;
        Object.defineProperty(newExports, "Elysia", {
          configurable: true,
          enumerable: true,
          get: () => {
            const ElysiaClass = exports.Elysia;
            if (!ElysiaClass) {
              return ElysiaClass;
            }

            if (!instrumented) {
              instrumented = true;
              METHODS.forEach((method) => {
                if (typeof ElysiaClass.prototype[method] === "function") {
                  wrapExport(ElysiaClass.prototype, method, pkgInfo, {
                    kind: undefined,
                    modifyArgs: (args) => this.wrapArgs(args),
                  });
                }
              });
            }

            return ElysiaClass;
          },
        });

        return newExports;
      })
      .addMultiFileInstrumentation(
        [
          "dist/index.js", // CJS
          "dist/index.mjs", // ESM
        ],
        [
          {
            nodeType: "MethodDefinition",
            name: "add",
            operationKind: undefined,
            modifyArgs: (args) => {
              // args: [method, path, handle, localHook?, options?]
              // handle is always at index 2
              return args.map((arg, i) => {
                if (i === 2 && typeof arg === "function") {
                  return wrapRequestHandler(
                    arg as Parameters<typeof wrapRequestHandler>[0]
                  );
                }
                return arg;
              });
            },
          },
        ]
      );
  }
}
