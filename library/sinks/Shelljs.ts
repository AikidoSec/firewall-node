import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
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

    // We do not have to check if its run as async, because then shelljs directly calls child_process.exec which is already protected
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
    const shelljs = hooks.addPackage("shelljs").withVersion("^0.8.0 || ^0.7.0");
    const exports = shelljs.addSubject((exports) => exports);

    // We need to wrap exec, because shelljs is not using child_process.exec directly, it spawns a subprocess and shares the command via a json file. That subprocess then executes the command.
    exports.inspect("exec", (args) => {
      return this.inspectExec("exec", args);
    });
  }
}
