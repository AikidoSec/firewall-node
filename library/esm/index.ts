import isFirewallSupported from "../helpers/isFirewallSupported";
import {
  getMajorNodeVersion,
  getMinorNodeVersion,
} from "../helpers/getNodeVersion";

// Was added in v20.6.0 and v18.19.0
function isESMSupported() {
  const nodeMajor = getMajorNodeVersion();
  const nodeMinor = getMinorNodeVersion();
  return (
    nodeMajor >= 22 ||
    (nodeMajor === 20 && nodeMinor >= 6) ||
    (nodeMajor === 18 && nodeMinor >= 19)
  );
}

if (isFirewallSupported()) {
  if (isESMSupported()) {
    require("../agent/protect").protect(true);
  } else {
    // eslint-disable-next-line no-console
    console.error(
      "Error: Aikido Firewall requires Node.js v20.6.0 / v18.19.0 or higher to support ESM."
    );
  }
}
