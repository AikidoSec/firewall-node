import isFirewallSupported from "./helpers/isFirewallSupported";

const supported = isFirewallSupported();

if (supported) {
  require("./agent/protect").protect();
}
