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
  wrap(hooks: Hooks) {
    const childProcess = hooks.addBuiltinModule("child_process");

    childProcess
      .addSubject((exports) => exports)
      .inspect("exec", (args) => this.inspectExec(args, "exec"))
      .inspect("execSync", (args) => this.inspectExec(args, "execSync"))
      .inspect("spawn", (args) => this.inspectSpawn(args, "spawn"))
      .inspect("spawnSync", (args) => this.inspectSpawn(args, "spawnSync"))
      .inspect("execFile", (args) => this.inspectExecFile(args, "execFile"))
      .inspect("execFileSync", (args) =>
        this.inspectExecFile(args, "execFileSync")
      );
  }

  private inspectSpawn(args: unknown[], name: string) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (!this.usingShell(args)) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string") {
      let command = args[0];

      if (args.length > 1 && Array.isArray(args[1]) && args[1].length > 0) {
        command = `${command} ${args[1].join(" ")}`;
      }

      return checkContextForShellInjection({
        command: command,
        operation: `child_process.${name}`,
        context: context,
      });
    }
  }

  private inspectExecFile(args: unknown[], name: string) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (!this.usingShell(args)) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string") {
      let command = args[0];

      if (args.length > 1 && Array.isArray(args[1]) && args[1].length > 0) {
        command = `${command} ${args[1].join(" ")}`;
      }

      return checkContextForShellInjection({
        command: command,
        operation: `child_process.${name}`,
        context: context,
      });
    }
  }

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

  private usingShell(args: unknown[]): boolean {
    if (
      args.length > 0 &&
      typeof args[0] === "string" &&
      this.isShellCommand(args[0])
    ) {
      return true;
    }

    return args.some(
      (arg) =>
        isPlainObject(arg) &&
        "shell" in arg &&
        (arg.shell === true || typeof arg.shell === "string")
    );
  }
}
