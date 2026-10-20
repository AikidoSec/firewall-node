import { resolve as resolveMaybeWrapped } from "path";
import { getOriginal } from "./wrap";

const resolve = getOriginal(resolveMaybeWrapped);

export function getAgentVersion(): string {
  try {
    const json = require(resolve(__dirname, "../package.json"));

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
