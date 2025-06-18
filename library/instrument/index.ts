import * as mod from "node:module";
import shouldEnableFirewall from "../helpers/shouldEnableFirewall";
import isFirewallSupported from "../helpers/isFirewallSupported";
import { protectWithNewInstrumentation } from "../agent/protect";
import { setIsNewHookSystemUsed } from "../agent/isNewHookSystemUsed";

setIsNewHookSystemUsed(true);

const isSupported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();
if (shouldEnable && isSupported) {
  if (!("registerHooks" in mod) || typeof mod.registerHooks !== "function") {
    // eslint-disable-next-line no-console
    console.error(
      "Error: Aikido Firewall requires that your Node.js version supports the `module.registerHooks` API. Please upgrade to a newer version of Node.js."
    );
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "AIKIDO: The new instrumentation system with ESM support is still under active development and not suitable for production use."
    );
    protectWithNewInstrumentation();
  }
}
