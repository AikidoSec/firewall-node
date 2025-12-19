import { join } from "node:path";
import { getInstance } from "../agent/AgentSingleton";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { inspectArgs } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { getLibraryRoot } from "../helpers/getLibraryRoot";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { checkContextForJsInjection } from "../vulnerabilities/js-injection/checkContextForJsInjection";
import { existsSync } from "node:fs";

export class Function implements Wrapper {
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

  private loadNativeAddon() {
    const majorVersion = getMajorNodeVersion();
    const arch = process.arch;
    const platform = process.platform;

    const nodeInternalsDir = join(getLibraryRoot(), "node_internals");
    const binaryPath = join(
      nodeInternalsDir,
      `zen-internals-node-${platform}-${arch}-node${majorVersion}.node`
    );
    if (!existsSync(binaryPath)) {
      // oxlint-disable-next-line no-console
      console.warn(
        `AIKIDO: Cannot find native addon for Node.js ${majorVersion} on ${platform}-${arch}. Function sink will not be instrumented.`
      );
      return;
    }

    const bindings: {
      setCodeGenerationCallback: (
        callback: (code: string) => string | undefined
      ) => void;
    } = require(binaryPath);
    if (!bindings || typeof bindings.setCodeGenerationCallback !== "function") {
      // oxlint-disable-next-line no-console
      console.warn(
        `AIKIDO: Native addon for Node.js ${majorVersion} on ${platform}-${arch} is invalid. Function sink will not be instrumented.`
      );
      return;
    }

    return bindings;
  }

  wrap(_: Hooks) {
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
