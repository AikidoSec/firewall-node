import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";
import { basename } from "path";

export class ChildProcess implements Wrapper {
  private inspectExec(
    args: unknown[],
    name: string,
    context: Context
  ): InterceptorResult {
    if (args.length > 0 && typeof args[0] === "string") {
      const command = args[0];
      const options = args[1];

      let shell = process.env.SHELL || "";
      if (isPlainObject(options) && typeof options.shell === "string") {
        shell = options.shell;
      }

      const shellName = basename(shell);

      if (shellName !== "sh" && shellName !== "bash") {
        return undefined;
      }

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

    childProcess.addSubject((exports) => exports);
  }
}
