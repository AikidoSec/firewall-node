import { colorText } from "./colorText";
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
        "AIKIDO: Your application entrypoint appears to be using ESM syntax. You need to use the new hook system to enable Zen. See our ESM documentation for setup instructions (https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md)."
      )
    );
  }
}
