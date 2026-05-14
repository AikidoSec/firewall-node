import { colorText } from "./colorText";
import { warnBox } from "./warnBox";
import { getEntrypointFromCLIArgs } from "./getEntrypointFromCLIArgs";
import { looksLikeModuleSyntax } from "./looksLikeModuleSyntax";

export function warnIfEntrypointIsModule() {
  const entrypoint = getEntrypointFromCLIArgs();
  if (!entrypoint) {
    return;
  }

  const looksLikeModule = looksLikeModuleSyntax(entrypoint);
  if (looksLikeModule) {
    // oxlint-disable-next-line no-console
    console.warn(
      colorText(
        "red",
        warnBox(
          "Zen is NOT protecting your application. Your entrypoint uses ESM syntax, which requires the new hook system. Setup instructions: https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md"
        )
      )
    );
  }
}
