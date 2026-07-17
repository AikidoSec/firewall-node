import { getContext } from "../agent/Context";
import type { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { clone } from "../helpers/clone";
import { notNormalizedNoSqlFilterSymbol } from "./MongoDB";

export class Mongoose implements Wrapper {
  #inspectFilter(args: unknown[]): void {
    const context = getContext();

    if (
      args.length <= 1 ||
      !context ||
      !args[1] ||
      typeof args[1] !== "object"
    ) {
      return;
    }

    const filter = args[1];

    // Save the original, not normalized filter in the context, as we might not be able to match the normalized filter with the payload
    // It is then checked in the MongoDB sink when we inspect the filter
    Object.defineProperty(filter, notNormalizedNoSqlFilterSymbol, {
      value: clone(filter),
      writable: false,
      enumerable: false,
      configurable: true,
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("mongoose")
      .withVersion("^6.0.0 || ^7.0.0 || ^8.0.0 || ^9.0.0")
      .onFileRequire("lib/cast.js", (exports, pkgInfo) => {
        return wrapExport(exports, undefined, pkgInfo, {
          kind: undefined, // Not using nosql_op since we wrap MongoDB driver itself
          inspectArgs: (args) => this.#inspectFilter(args),
        });
      })
      .addFileInstrumentation({
        path: "lib/cast.js",
        functions: [
          {
            name: "cast",
            nodeType: "FunctionExpression",
            operationKind: undefined, // Not using nosql_op since we wrap MongoDB driver itself
            inspectArgs: (args) => this.#inspectFilter(args),
          },
        ],
      });
  }
}
