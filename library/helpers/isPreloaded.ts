/**
 * Checks whever the args include --require / -r or --import @aikidosec/firewall
 * Also checks NODE_OPTIONS.
 */
export function isPreloaded(): boolean {
  const processArgs = process.execArgv;
  if (checkArgsForPreload(processArgs)) {
    return true;
  }

  const nodeOptions = process.env.NODE_OPTIONS;
  if (nodeOptions) {
    const nodeOptionsArgs = nodeOptions.split(" ");
    if (checkArgsForPreload(nodeOptionsArgs)) {
      return true;
    }
  }

  return false;
}

function checkArgsForPreload(args: string[]): boolean {
  for (const arg of args) {
    if (arg !== "--require" && arg !== "-r" && arg !== "--import") {
      continue;
    }

    const index = args.indexOf(arg);
    if (index === -1 || index === args.length - 1) {
      continue;
    }

    const moduleName = args[index + 1];
    if (moduleName && moduleName.includes("@aikidosec/firewall")) {
      return true;
    }
  }

  return false;
}
