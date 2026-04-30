import isFirewallSupported from "../helpers/isFirewallSupported";
import shouldEnableFirewall from "../helpers/shouldEnableFirewall";
import { protect, setToken } from "../agent/protect";

if (isFirewallSupported() && shouldEnableFirewall({ enabledByDefault: true })) {
  protect();
}

export { setToken };
