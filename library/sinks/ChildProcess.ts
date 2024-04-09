import { Context } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

export class ChildProcess implements Wrapper {
  private inspectExec(
    args: unknown[],
    name: string,
    context: Context
  ): InterceptorResult {
    // Ignore calls to spawn or spawnSync if shell option is not enabled
    if (name === "spawn" || name === "spawnSync") {
      const unsafeShellOption = args.find(
        (arg) =>
          isPlainObject(arg) &&
          "shell" in arg &&
          (arg.shell === true || typeof arg.shell === "string")
      );

      if (!unsafeShellOption) {
        return undefined;
      }
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
      .inspect("exec", (args, subject, agent, context) =>
        this.inspectExec(args, "exec", context)
      )
      .inspect("execSync", (args, subject, agent, context) =>
        this.inspectExec(args, "execSync", context)
      )
      .inspect("spawn", (args, subject, agent, context) =>
        this.inspectExec(args, "spawn", context)
      )
      .inspect("spawnSync", (args, subject, agent, context) =>
        this.inspectExec(args, "spawnSync", context)
      );
  }
}
