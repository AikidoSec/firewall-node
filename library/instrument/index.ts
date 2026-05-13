/* oxlint-disable no-console */

import * as mod from "node:module";
import shouldEnableFirewall from "../helpers/shouldEnableFirewall";
import isFirewallSupported from "../helpers/isFirewallSupported";
import { protectWithNewInstrumentation } from "../agent/protect";
import { setIsNewHookSystemUsed } from "../agent/isNewHookSystemUsed";
import { checkIndexImportGuard } from "../helpers/indexImportGuard";
import { isMainThread } from "node:worker_threads";
import { isESM } from "../helpers/isESM";
import { isPreloaded } from "../helpers/isPreloaded";
import { colorText } from "../helpers/colorText";
import { warnBox } from "../helpers/warnBox";

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
      colorText(
        "red",
        warnBox(
          "AIKIDO: Zen is NOT protecting your application. Your Node.js version does not support module.registerHooks. Upgrade Node.js or see https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md"
        )
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
        warnBox(
          "AIKIDO: Zen is NOT protecting your application. Your ESM app needs the library preloaded with --require. See https://github.com/AikidoSec/firewall-node/blob/main/docs/esm.md"
        )
      )
    );
  }

  protectWithNewInstrumentation();
}

start();
