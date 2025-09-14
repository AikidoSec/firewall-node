/* eslint-disable no-console */
import { getMajorNodeVersion } from "./getNodeVersion";

export default function isFirewallSupported() {
  // Check for unsupported Node.js versions
  if (getMajorNodeVersion() < 16) {
    console.error(
      "Error: Aikido Firewall requires Node.js 16 or higher to run."
    );

    return false;
  }

  return true;
}
