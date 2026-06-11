import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapRequestHandler } from "./elysia/wrapRequestHandler";
import { wrapExport } from "../agent/hooks/wrapExport";

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

  private wrapOnArgs(args: unknown[]) {
    return args.map((arg) => {
      if (typeof arg === "function") {
        return wrapRequestHandler(
          arg as Parameters<typeof wrapRequestHandler>[0]
        );
      }

      if (Array.isArray(arg)) {
        return arg.map((item) => {
          if (typeof item === "function") {
            return wrapRequestHandler(
              item as Parameters<typeof wrapRequestHandler>[0]
            );
          }
          return item;
        });
      }

      return arg;
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
              wrapExport(ElysiaClass.prototype, "add", pkgInfo, {
                kind: undefined,
                modifyArgs: (args) => this.wrapArgs(args),
              });
              wrapExport(ElysiaClass.prototype, "on", pkgInfo, {
                kind: undefined,
                modifyArgs: (args) => this.wrapOnArgs(args),
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
            modifyArgs: (args) => this.wrapArgs(args),
          },
          {
            nodeType: "MethodDefinition",
            name: "on",
            operationKind: undefined,
            modifyArgs: (args) => this.wrapOnArgs(args),
          },
        ]
      );
  }
}
