import { join } from "path";
import { getLibraryRoot } from "./getLibraryRoot";

export function getAgentVersion(): string {
  try {
    const json = require(join(getLibraryRoot(), "package.json"));

    /* c8 ignore start */
    if (!json.version) {
      throw new Error("Missing version in package.json");
    }
    /* c8 ignore stop */

    return json.version;
    /* c8 ignore start */
  } catch {
    return "0.0.0";
  }
  /* c8 ignore stop */
}
