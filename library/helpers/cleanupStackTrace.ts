import { sep } from "node:path";

export function cleanupStackTrace(stack: string, libraryRoot: string): string {
  return stack
    .split("\n")
    .filter((line) => {
      if (!line.trimStart().startsWith("at ")) {
        return true;
      }

      // e.g. at Collection.wrap (/Code/runtime-node/build/agent/applyHooks.js:154:75)
      // e.g. at /Code/runtime-node/build/sources/express/wrapRequestHandler.js:22:20
      const path = line.match(/\(([^)]+)\)/)?.[1] || line.split(" ").pop();

      if (!path || !path.includes(sep)) {
        return true;
      }

      const isPartOfFirewall = path.startsWith(libraryRoot);

      return !isPartOfFirewall;
    })
    .join("\n");
}
