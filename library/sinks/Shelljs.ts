import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

export class Shelljs implements Wrapper {
  private inspectExec(operation: string, args: unknown[]): InterceptorResult {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (typeof args[0] !== "string") {
      return undefined;
    }

    // We do not have to check if it's run as async, because then shelljs directly calls child_process.exec which is already protected
    if (args.length > 1) {
      // async option is set to true
      if (isPlainObject(args[1]) && args[1].async === true) {
        return undefined;
      }
      // callback function is passed as second argument
      if (typeof args[1] === "function") {
        return undefined;
      }
      // callback function is passed as third argument
      if (args.length > 2 && typeof args[2] === "function") {
        return undefined;
      }
    }

    return checkContextForShellInjection({
      command: args[0],
      operation: `shelljs.${operation}`,
      context: context,
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("shelljs")
      .withVersion("^0.9.0 || ^0.8.0 || ^0.7.0")
      // We need to wrap exec, because shelljs is not using child_process.exec directly, it spawns a subprocess and shares the command via a json file. That subprocess then executes the command.
      .onFileRequire("src/common.js", (exports, pkgInfo) => {
        wrapExport(exports, "register", pkgInfo, {
          kind: undefined,
          modifyArgs: (args) => {
            if (
              args.length > 0 &&
              args[0] === "exec" &&
              typeof args[1] === "function"
            ) {
              args[1] = wrapExport(args[1], undefined, pkgInfo, {
                kind: "exec_op",
                inspectArgs: (args) => this.inspectExec("exec", args),
              });
            }

            return args;
          },
        });
      })
      .addFileInstrumentation({
        path: "src/exec.js",
        functions: [
          {
            name: "execSync",
            nodeType: "FunctionDeclaration",
            operationKind: "exec_op",
            inspectArgs: (args) => this.inspectExec("exec", args),
          },
        ],
      });
  }
}
