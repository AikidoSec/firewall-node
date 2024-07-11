import * as os from "node:os";

/**
 * Get the IP Address of the machine running this code
 */
export function ip(interfaceName?: string) {
  const item = getInterfaceAddress("IPv4", interfaceName);
  /* c8 ignore next */
  return item?.address;
}

function getDefaultInterfaceName() {
  let val: string | undefined = "eth";
  const platform = os.platform();
  if (platform === "darwin") {
    val = "en";
  } else if (platform === "win32") {
    val = undefined;
  }

  return val;
}

function matchName(
  actualFamily: string | number,
  expectedFamily: string | number
) {
  if (expectedFamily === "IPv4") {
    return actualFamily === "IPv4" || actualFamily === 4;
  }
  /* c8 ignore start */
  if (expectedFamily === "IPv6") {
    return actualFamily === "IPv6" || actualFamily === 6;
  }

  return actualFamily === expectedFamily;
}
/* c8 ignore stop */

function getInterfaceAddress(family?: string, name?: string) {
  const interfaces = os.networkInterfaces();
  const noName = !name;
  name = name || getDefaultInterfaceName();
  /* c8 ignore next */
  family = family || "IPv4";
  if (name) {
    for (let i = -1; i < 8; i++) {
      const interfaceName = name + (i >= 0 ? i : ""); // support 'lo' and 'lo0'
      const items = interfaces[interfaceName];
      if (items) {
        for (const item of items) {
          if (matchName(item.family, family)) {
            return item;
          }
        } /* c8 ignore start */
      }
    }
  }
  /* c8 ignore stop */

  if (noName) {
    // filter all loopback or local addresses
    for (const k in interfaces) {
      const items = interfaces[k];
      if (items) {
        for (const item of items) {
          // all 127 addresses are local and should be ignored
          if (
            matchName(item.family, family) &&
            !item.address.startsWith("127.")
          ) {
            return item;
          }
        }
      } /* c8 ignore start */
    }
  }
  /* c8 ignore stop */
}
