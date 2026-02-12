/**
 * Checks whever the args include --require / -r or --import @aikidosec/firewall
 */
export function isPreloaded(): boolean {
  for (const arg of process.execArgv) {
    if (arg === "--require" || arg === "-r" || arg === "--import") {
      const index = process.execArgv.indexOf(arg);
      const moduleName = process.execArgv[index + 1];
      if (moduleName && moduleName.includes("@aikidosec/firewall")) {
        return true;
      }
    }
  }

  return false;
}
