import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { checkContextForShellInjection } from "../vulnerabilities/shell-injection/checkContextForShellInjection";

export class ChildProcess implements Wrapper {
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

      if (!unsafeShellOption) {
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
    const methods = [
      "exec",
      "execSync",
      "spawn",
      "spawnSync",
      "execFile",
      "execFileSync",
    ];

    hooks.addBuiltinModule("child_process").onRequire((exports, pkgInfo) => {
      for (const method of methods) {
        wrapExport(exports, method, pkgInfo, {
          inspectArgs: (args) => {
            return this.inspectExec(args, method);
          },
        });
      }
    });
  }
}
