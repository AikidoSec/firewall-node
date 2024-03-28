import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

export class ChildProcess implements Wrapper {
  private inspectExec(
    args: unknown[],
    name: string,
    context: Context
  ): InterceptorResult {
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
      .inspect("exec", (args, subject, agent, context) =>
        this.inspectExec(args, "exec", context)
      )
      .inspect("execSync", (args, subject, agent, context) =>
        this.inspectExec(args, "execSync", context)
      );
  }
}
