import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";

export class Function implements Wrapper {
  private inspectFunction(args: any[]) {
    const context = getContext();

    if (!context || !Array.isArray(args) || args.length === 0) {
      return undefined;
    }

    const findLastStringArg = (args: any[]) => {
      for (let i = args.length - 1; i >= 0; --i) {
        if (typeof args[i] === "string") {
          return args[i];
        }
      }
      return undefined;
    };

    const lastStringArg = findLastStringArg(args);

    if (lastStringArg) {
      return checkContextForJsInjection({
        js: lastStringArg,
        operation: "new Function",
        context,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks.addGlobal("Function", {
      inspectArgs: this.inspectFunction,
    });
  }
}
