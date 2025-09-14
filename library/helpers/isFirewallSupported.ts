/* eslint-disable no-console */
import { getMajorNodeVersion } from "./getNodeVersion";

export default function isFirewallSupported() {
  // @ts-expect-error Unknown type of globalThis
  if (globalThis.Deno) {
    const runtimeName = "Deno";
    console.error(
      `Error: Aikido Firewall does not support ${runtimeName}. If you want support for ${runtimeName}, please contact us: hello@aikido.dev`
    );

    return false;
  }

  // Check for unsupported Node.js versions
  if (getMajorNodeVersion() < 16) {
    console.error(
      "Error: Aikido Firewall requires Node.js 16 or higher to run."
    );

    return false;
  }

  return true;
}
