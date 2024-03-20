import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

export class ChildProcess implements Wrapper {
  private inspectExec(args: unknown[], name: string): InterceptorResult {
    const context = getContext();

    if (!context) {
      return;
    }

    if (args.length > 0 && typeof args[0] === "string") {
      const command = args[0];
      const options = args[1];

      let shell = process.env.SHELL;
      if (isPlainObject(options) && typeof options.shell === "string") {
        shell = options.shell;
      }

      if (!shell) {
        return undefined;
      }

      return checkContextForShellInjection({
        command: command,
        operation: `child_process.${name}`,
        context: context,
        pathToShell: shell,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    const childProcess = hooks.addBuiltinModule("child_process");

    childProcess
      .addSubject((exports) => exports)
      .inspect("exec", (args) => this.inspectExec(args, "exec"))
      .inspect("execSync", (args) => this.inspectExec(args, "execSync"));

    childProcess.addSubject((exports) => exports);
  }
}
