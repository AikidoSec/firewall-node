import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { inspectArgs, wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";
import { getInstance } from "../agent/AgentSingleton";

export class NodeVm implements Wrapper {
  private inspectCode(args: unknown[], operation: string) {
    const context = getContext();
    if (!context) {
      return undefined;
    }

    if (args.length === 0 || typeof args[0] !== "string") {
      return undefined;
    }

    const code = args[0];

    return checkContextForJsInjection({
      js: code,
      operation,
      context,
    });
  }

  private onConstruct(target: any, args: unknown[]) {
    const agent = getInstance();
    const context = getContext();

    if (!agent || !context) {
      return new target(...args);
    }

    inspectArgs(
      args,
      () => this.inspectCode(args, "new Script(...)"),
      context,
      agent,
      {
        name: "vm",
        type: "builtin",
      },
      "new Script(...)",
      "eval_op"
    );

    return new target(...args);
  }

  wrap(hooks: Hooks): void {
    hooks.addBuiltinModule("vm").onRequire((exports, pkgInfo) => {
      // We can't use our helper wrapNewInstance because it can not inspect constructor args
      exports.Script = new Proxy(exports.Script, {
        construct: (target, args) => this.onConstruct(target, args),
      });

      const functionsToWrap = [
        "createScript",
        "runInThisContext",
        "runInNewContext",
        "runInContext",
        "compileFunction",
      ];

      for (const functionName of functionsToWrap) {
        if (typeof exports[functionName] === "function") {
          wrapExport(exports, functionName, pkgInfo, {
            kind: "eval_op",
            inspectArgs: (args) =>
              this.inspectCode(args, `${functionName}(...)`),
          });
        }
      }
    });
  }
}
