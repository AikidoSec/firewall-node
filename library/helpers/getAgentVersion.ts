import { resolve } from "path";

export function getAgentVersion(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const json = require(resolve(__dirname, "../package.json"));

  /* c8 ignore start */
  if (!json.version) {
    throw new Error("Missing version in package.json");
  }
  /* c8 ignore stop */

  return json.version;
}
