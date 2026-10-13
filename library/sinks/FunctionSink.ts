import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { inspectArgs } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { envToBool } from "../helpers/envToBool";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";
import { colorText } from "../helpers/colorText";
import { warnBox } from "../helpers/warnBox";
import { loadNodeInternals } from "../helpers/loadNodeInternals";
import { isCodeGenerationFromStringsDisallowed } from "../helpers/isCodeGenerationFromStringsDisallowed";

export class FunctionSink implements Wrapper {
  private inspectFunction(args: unknown[]): InterceptorResult {
    if (args.length === 0) {
      return undefined;
    }

    const code = args[0];
    if (!code || typeof code !== "string") {
      return undefined;
    }

    const context = getContext();
    if (!context) {
      return undefined;
    }

    return checkContextForJsInjection({
      js: code,
      operation: "new Function/eval",
      context,
    });
  }

  private loadNativeAddon():
    | {
        setCodeGenerationCallback: (
          callback: (code: string) => string | undefined
        ) => void;
      }
    | undefined {
    const majorVersion = getMajorNodeVersion();
    const arch = process.arch;
    const platform = process.platform;
    const { bindings, error } = loadNodeInternals();

    if (!bindings) {
      const message = error
        ? `Failed to load native addon for Node.js ${majorVersion} on ${platform}-${arch}: ${error.message}`
        : `Cannot find native addon for Node.js ${majorVersion} on ${platform}-${arch}. Request support: https://github.com/AikidoSec/firewall-node/issues`;
      // oxlint-disable-next-line no-console
      console.warn(
        colorText(
          "red",
          warnBox(
            `Zen will NOT block code injection attacks (eval, new Function). ${message}`
          )
        )
      );
      return;
    }

    if (typeof bindings.setCodeGenerationCallback !== "function") {
      // oxlint-disable-next-line no-console
      console.warn(
        colorText(
          "red",
          warnBox(
            `Zen will NOT block code injection attacks (eval, new Function). Native addon for Node.js ${majorVersion} on ${platform}-${arch} is invalid.`
          )
        )
      );
      return;
    }

    return {
      setCodeGenerationCallback: bindings.setCodeGenerationCallback,
    };
  }

  wrap(_: Hooks) {
    if (envToBool(process.env.AIKIDO_DISABLE_CODE_GENERATION_HOOK)) {
      return;
    }

    // If Node was started with --disallow-code-generation-from-strings, V8 already
    // blocks every eval and new Function() call. We use the same V8 hook, so if we
    // registered our callback it would override that and let eval run again for code
    // that doesn't come from a request. So we do nothing and let Node keep blocking
    // everything. No warning needed: we only block eval when the code comes from user
    // input, and Node already blocks all of it, including those cases.
    if (isCodeGenerationFromStringsDisallowed()) {
      return;
    }

    const bindings = this.loadNativeAddon();
    if (!bindings) {
      return;
    }

    bindings.setCodeGenerationCallback((code: string) => {
      const agent = getInstance();
      if (!agent) {
        return;
      }

      const context = getContext();
      if (!context) {
        return;
      }

      try {
        inspectArgs(
          [code],
          this.inspectFunction,
          context,
          agent,
          {
            name: "Function/eval",
            type: "global",
          },
          "<compile>",
          "eval_op"
        );
      } catch (error) {
        // In blocking mode, onInspectionInterceptorResult would throw to block the operation
        // To block the code generation, we need to return a string that will be used for the thrown error message
        return (error as Error).message;
      }
    });
  }
}
