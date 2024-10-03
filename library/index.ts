import isFirewallSupported from "./helpers/isFirewallSupported";
import shouldEnableFirewall from "./helpers/shouldEnableFirewall";

const supported = isFirewallSupported();
const shouldEnable = shouldEnableFirewall();

if (supported && shouldEnable) {
  require("./agent/protect").protect();
}
