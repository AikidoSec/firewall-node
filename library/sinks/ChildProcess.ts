import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/MethodInterceptor";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

const PATH_PREFIXES = [
  "/bin/",
  "/sbin/",
  "/usr/bin/",
  "/usr/sbin/",
  "/usr/local/bin/",
  "/usr/local/sbin/",
];

export class ChildProcess implements Wrapper {
  private isShellCommand(command: string): boolean {
    for (const prefix of PATH_PREFIXES) {
      for (const shellCommand of ["bash", "zsh", "sh"]) {
        if (
          command === `${prefix}${shellCommand}` ||
          command === shellCommand
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private inspectExec(args: unknown[], name: string): InterceptorResult {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    // Ignore calls to spawn, spawnSync, execFile and execFileSync if shell option is not enabled
    if (
      name === "spawn" ||
      name === "spawnSync" ||
      name === "execFile" ||
      name === "execFileSync"
    ) {
      const unsafeShellOption = args.find(
        (arg) =>
          isPlainObject(arg) &&
          "shell" in arg &&
          (arg.shell === true || typeof arg.shell === "string")
      );

      if (
        !unsafeShellOption &&
        typeof args[0] == "string" &&
        !this.isShellCommand(args[0])
      ) {
        return undefined;
      }
    }

    if (args.length > 0 && typeof args[0] === "string") {
      let command = args[0];

      if (
        (name === "spawn" ||
          name === "spawnSync" ||
          name === "execFile" ||
          name === "execFileSync") &&
        args.length > 1 &&
        Array.isArray(args[1]) &&
        args[1].length > 0
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
      .inspect("spawnSync", (args) => this.inspectExec(args, "spawnSync"))
      .inspect("execFile", (args) => this.inspectExec(args, "execFile"))
      .inspect("execFileSync", (args) =>
        this.inspectExec(args, "execFileSync")
      );
  }
}
