import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";

export class Eval implements Wrapper {
  private inspectEval(args: any[]) {
    const context = getContext();

    if (!context) {
      return undefined;
    }

    if (args.length === 1 && typeof args[0] === "string") {
      return checkContextForJsInjection({
        js: args[0],
        operation: "eval",
        context,
      });
    }

    return undefined;
  }

  wrap(hooks: Hooks) {
    hooks.addGlobal("eval", {
      inspectArgs: this.inspectEval,
    });
  }
}
