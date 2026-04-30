/* oxlint-disable no-console */

import * as mod from "node:module";
import { isMainThread } from "node:worker_threads";
import { getInstance } from "../agent/AgentSingleton";
import { setIsNewHookSystemUsed } from "../agent/isNewHookSystemUsed";
import { colorText } from "../helpers/colorText";
import { checkIndexImportGuard } from "../helpers/indexImportGuard";
import isFirewallSupported from "../helpers/isFirewallSupported";
import { isESM } from "../helpers/isESM";
import { isPreloaded } from "../helpers/isPreloaded";
import shouldEnableFirewall from "../helpers/shouldEnableFirewall";

export function startWithNewInstrumentation(startAgent: () => void): void {
  setIsNewHookSystemUsed(true);

  const isSupported = isFirewallSupported();
  const alreadyRunning = !!getInstance();
  const shouldEnable = alreadyRunning || shouldEnableFirewall();
  const notAlreadyImported = checkIndexImportGuard();

  if (!isSupported || !shouldEnable || !notAlreadyImported) {
    return;
  }

  if (!("registerHooks" in mod) || typeof mod.registerHooks !== "function") {
    console.error(
      colorText(
        "red",
        "AIKIDO: Error: Zen requires that your Node.js version supports the `module.registerHooks` API. Please upgrade to a newer version of Node.js. See our ESM documentation for setup instructions (https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md)."
      )
    );
    return;
  }

  if (!isMainThread) {
    console.warn(
      "AIKIDO: Zen does not instrument worker threads. Zen will only be active in the main thread."
    );
    return;
  }

  if (isESM() === true && !isPreloaded()) {
    console.error(
      colorText(
        "red",
        "AIKIDO: Error: Your application seems to be running in ESM mode without preloading the library. Please use --require to preload the library. See our ESM documentation for setup instructions (https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md)."
      )
    );
  }

  startAgent();
}
