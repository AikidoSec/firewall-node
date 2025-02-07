import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForPathTraversal } from "../vulnerabilities/path-traversal/checkContextForPathTraversal";
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
    hooks.addBuiltinModule("child_process").onRequire((exports, pkgInfo) => {
      wrapExport(exports, "exec", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectExec(args, "exec");
        },
      });
      wrapExport(exports, "execSync", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectExec(args, "execSync");
        },
      });
      wrapExport(exports, "spawn", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectSpawn(args, "spawn");
        },
      });
      wrapExport(exports, "spawnSync", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectSpawn(args, "spawnSync");
        },
      });
      wrapExport(exports, "execFile", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectExecFile(args, "execFile");
        },
      });
      wrapExport(exports, "execFileSync", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectExecFile(args, "execFileSync");
        },
      });
      wrapExport(exports, "fork", pkgInfo, {
        inspectArgs: (args) => {
          return this.inspectFork(args, "fork");
        },
      });
    });
  }

  private inspectFork(args: unknown[], name: string) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length > 0 && typeof args[0] === "string") {
      const modulePath = args[0];

      return checkContextForPathTraversal({
        filename: modulePath,
        operation: `child_process.${name}`,
        context: context,
      });
    }

    return undefined;
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
