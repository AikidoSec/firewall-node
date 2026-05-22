import { isUsingTurbopack } from "./isUsingTurbopack";
import { colorText } from "./colorText";
import { warnBox } from "./warnBox";

export function warnIfUsingTurbopackWithOldSystem(): void {
  // Defer so that Next.js standalone server.js can set __NEXT_PRIVATE_STANDALONE_CONFIG first
  setImmediate(() => {
    try {
      if (isUsingTurbopack()) {
        // oxlint-disable-next-line no-console
        console.warn(
          colorText(
            "red",
            warnBox(
              "Zen might not be protecting your application. Your app is using Turbopack, which requires the new hook system. Setup instructions: https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md"
            )
          )
        );
      }
    } catch {
      // Ignore errors to avoid crashing the application
    }
  });
}
