import { getInstance } from "../agent/AgentSingleton";
import { type Context, getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { inspectArgs } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { checkContextForInsecureImport } from "../vulnerabilities/dynamic-import/checkContextForInsecureImport";

export class ImportSink implements Wrapper {
  private static inspectImport(
    args: [string],
    context: Context
  ): InterceptorResult {
    const [specifier] = args;

    return checkContextForInsecureImport({
      specifier,
      context,
    });
  }

  static checkImport(specifier: string) {
    const agent = getInstance();
    if (!agent) {
      return undefined;
    }

    const context = getContext();
    if (!context) {
      return undefined;
    }

    inspectArgs(
      [specifier],
      (args) => this.inspectImport(args as [string], context),
      context,
      agent,
      {
        name: "import/require",
        type: "global",
      },
      "import/require",
      "import_op"
    );
  }

  wrap(_: Hooks) {
    //
  }
}
