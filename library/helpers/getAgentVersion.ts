export function getAgentVersion(): string {
  const json = require("../package.json");

  /* c8 ignore start */
  if (!json.version) {
    throw new Error("Missing version in package.json");
  }
  /* c8 ignore stop */

  return json.version;
}
