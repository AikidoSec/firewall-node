import * as module from "node:module";
import shouldEnableFirewall from "../helpers/shouldEnableFirewall";
import isFirewallSupported from "../helpers/isFirewallSupported";
import { protectWithNewInstrumentation } from "../agent/protect";

const isSupported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();
if (shouldEnable && isSupported) {
  if (
    !("registerHooks" in module) ||
    typeof module.registerHooks !== "function"
  ) {
    // eslint-disable-next-line no-console
    console.error(
      "Error: Aikido Firewall requires that your Node.js version supports the `module.registerHooks` API. Please upgrade to a newer version of Node.js."
    );
  } else {
    protectWithNewInstrumentation();
  }
}
