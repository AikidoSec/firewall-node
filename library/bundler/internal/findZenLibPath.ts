import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { isUnitTest } from "../../helpers/isUnitTest";

export function findZenLibPath(): string {
  if (isUnitTest()) {
    // in unit tests, we need to go up two directories to find the library path
    return resolve(__dirname, "../../");
  }

  // create a require function relative to current file
  const requireFunc = createRequire(__dirname);
  // resolve the library path
  return dirname(requireFunc.resolve("@aikidosec/firewall"));
}
