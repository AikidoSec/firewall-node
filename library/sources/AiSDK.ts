import type { Tool } from "ai";
import type { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import type { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { wrapToolExecution } from "./ai/wrapToolExecution";

export class AiSDK implements Wrapper {
  private wrapToolExecution(args: unknown[]) {
    if (
      !args ||
      args.length === 0 ||
      !isPlainObject(args[0]) ||
      typeof args[0].execute !== "function"
    ) {
      return args;
    }

    const toolObject = args[0] as Tool & {
      execute: NonNullable<Tool["execute"]>;
    };

    toolObject.execute = wrapToolExecution(toolObject.execute);

    return args;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("ai")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        const toolFunc = exports.tool; // It's a getter so we can't directly pass it to wrapExport

        const wrappedToolFunc = wrapExport(toolFunc, undefined, pkgInfo, {
          modifyArgs: (args) => this.wrapToolExecution(args),
        });

        return {
          ...exports,
          tool: wrappedToolFunc,
        };
      });
  }
}
