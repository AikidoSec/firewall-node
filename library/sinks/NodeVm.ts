import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { inspectArgs, wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";
import { getInstance } from "../agent/AgentSingleton";
import {
  markContextDisabled,
  isContextDisabled,
  runWithCodeGenDisabled,
} from "../helpers/vmContextsWithCodeGenerationDisabled";

type CodeGenerationOptionKey = "codeGeneration" | "contextCodeGeneration";

function hasCodeGenerationFromStringsDisabled(
  options: unknown,
  optionKey: CodeGenerationOptionKey
): boolean {
  if (!options || typeof options !== "object") {
    return false;
  }

  const codeGeneration = (options as Record<string, unknown>)[optionKey];

  return (
    !!codeGeneration &&
    typeof codeGeneration === "object" &&
    (codeGeneration as { strings?: unknown }).strings === false
  );
}

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

  private onConstruct(target: any, args: unknown[], newTarget: Function) {
    const agent = getInstance();
    const context = getContext();

    if (!agent || !context) {
      return Reflect.construct(target, args, newTarget);
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

    return Reflect.construct(target, args, newTarget);
  }

  wrap(hooks: Hooks): void {
    hooks.addBuiltinModule("vm").onRequire((exports, pkgInfo) => {
      const originalCreateContext = exports.createContext;
      const originalRunInContext = exports.runInContext;
      const originalRunInNewContext = exports.runInNewContext;
      const originalScriptRunInContext = exports.Script.prototype.runInContext;
      const originalScriptRunInNewContext =
        exports.Script.prototype.runInNewContext;

      if (typeof originalCreateContext === "function") {
        exports.createContext = function createContext(
          this: unknown,
          ...args: unknown[]
        ) {
          const result = originalCreateContext.apply(this, args);
          if (hasCodeGenerationFromStringsDisabled(args[1], "codeGeneration")) {
            markContextDisabled(result);
          }
          return result;
        };
      }

      if (typeof originalRunInContext === "function") {
        exports.runInContext = function runInContext(
          this: unknown,
          ...args: unknown[]
        ) {
          const disabled = isContextDisabled(args[1]);
          return runWithCodeGenDisabled(disabled, () =>
            originalRunInContext.apply(this, args)
          );
        };
      }

      if (typeof originalScriptRunInContext === "function") {
        exports.Script.prototype.runInContext = function runInContext(
          this: unknown,
          ...args: unknown[]
        ) {
          const disabled = isContextDisabled(args[0]);
          return runWithCodeGenDisabled(disabled, () =>
            originalScriptRunInContext.apply(this, args)
          );
        };
      }

      if (typeof originalRunInNewContext === "function") {
        exports.runInNewContext = function runInNewContext(
          this: unknown,
          ...args: unknown[]
        ) {
          const disabled = hasCodeGenerationFromStringsDisabled(
            args[2],
            "contextCodeGeneration"
          );
          return runWithCodeGenDisabled(disabled, () =>
            originalRunInNewContext.apply(this, args)
          );
        };
      }

      if (typeof originalScriptRunInNewContext === "function") {
        exports.Script.prototype.runInNewContext = function runInNewContext(
          this: unknown,
          ...args: unknown[]
        ) {
          const disabled = hasCodeGenerationFromStringsDisabled(
            args[1],
            "contextCodeGeneration"
          );
          return runWithCodeGenDisabled(disabled, () =>
            originalScriptRunInNewContext.apply(this, args)
          );
        };
      }

      // We can't use our helper wrapNewInstance because it can not inspect constructor args
      exports.Script = new Proxy(exports.Script, {
        construct: (target, args, newTarget) =>
          this.onConstruct(target, args, newTarget),
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
