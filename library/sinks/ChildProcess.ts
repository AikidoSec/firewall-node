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
      return undefined;
    }

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
      let command = args[0];

      if (
        (name === "spawn" || name === "spawnSync") &&
        args.length > 1 &&
        Array.isArray(args[1])
      ) {
        command += " " + args[1].join(" ");
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
      .inspect("exec", (args) => this.inspectExec(args, "exec"))
      .inspect("execSync", (args) => this.inspectExec(args, "execSync"))
      .inspect("spawn", (args) => this.inspectExec(args, "spawn"))
      .inspect("spawnSync", (args) => this.inspectExec(args, "spawnSync"));
  }
}
