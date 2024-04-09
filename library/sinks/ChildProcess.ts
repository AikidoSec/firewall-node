import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

export class ChildProcess implements Wrapper {
  private inspectExec(args: unknown[], name: string): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string") {
      const command = args[0];

      return checkContextForShellInjection({
        command: command,
        operation: `child_process.${name}`,
        context: context,
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
  }
}
