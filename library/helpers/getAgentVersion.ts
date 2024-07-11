import { resolve } from "node:path";

export function getAgentVersion(): string {
  const json = require(resolve(__dirname, "../package.json"));

  /* c8 ignore start */
  if (!json.version) {
    throw new Error("Missing version in package.json");
  }
  /* c8 ignore stop */

  return json.version;
}
