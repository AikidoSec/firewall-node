import { createRequire } from "node:module";
import { dirname } from "node:path";

export function findZenLibPath(): string {
  // create a require function relative to current file
  const requireFunc = createRequire(__dirname);
  // resolve the library path
  return dirname(requireFunc.resolve("@aikidosec/firewall"));
}
