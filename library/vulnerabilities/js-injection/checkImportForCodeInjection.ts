import { getInstance } from "../../agent/AgentSingleton";
import { getContext } from "../../agent/Context";
import type { LoadFunction } from "../../agent/hooks/instrumentation/types";
import { inspectArgs } from "../../agent/hooks/wrapExport";
import { decodeDataUrl } from "../../helpers/decodeDataUrl";
import { checkContextForJsInjection } from "./checkContextForJsInjection";

export function checkImportForCodeInjection(
  dataUrl: string,
  previousLoadResult: ReturnType<LoadFunction>
): ReturnType<LoadFunction> {
  const agent = getInstance();
  const context = getContext();
  if (!context || !agent) {
    return previousLoadResult;
  }

  inspectArgs(
    [dataUrl],
    (args) => {
      const dataUrl = args[0] as string;
      const code = decodeDataUrl(dataUrl);

      if (!code) {
        return undefined;
      }

      return checkContextForJsInjection({
        js: code,
        operation: "await import(...)",
        context,
      });
    },
    context,
    agent,
    {
      name: "module",
      type: "builtin",
    },
    "await import(...)",
    "eval_op"
  );

  return previousLoadResult;
}
