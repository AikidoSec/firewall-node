/* oxlint-disable no-console */

import * as mod from "node:module";
import shouldEnableFirewall from "../helpers/shouldEnableFirewall";
import isFirewallSupported from "../helpers/isFirewallSupported";
import { protectWithNewInstrumentation } from "../agent/protect";
import { setIsNewHookSystemUsed } from "../agent/isNewHookSystemUsed";
import { checkIndexImportGuard } from "../helpers/indexImportGuard";
import { isMainThread } from "node:worker_threads";

setIsNewHookSystemUsed(true);

const isSupported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();
const notAlreadyImported = checkIndexImportGuard();

function start() {
  if (!isSupported || !shouldEnable || !notAlreadyImported) {
    return;
  }

  if (!("registerHooks" in mod) || typeof mod.registerHooks !== "function") {
    console.error(
      "AIKIDO: Error: Zen requires that your Node.js version supports the `module.registerHooks` API. Please upgrade to a newer version of Node.js."
    );
    return;
  }

  if (!isMainThread) {
    console.warn(
      "AIKIDO: Zen does not instrument worker threads. Zen will only be active in the main thread."
    );
    return;
  }

  protectWithNewInstrumentation();
}

start();
