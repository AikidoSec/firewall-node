import { resolve } from "path";

export function getAgentVersion(): string {
  // You would expect ../../package.json, but the build process moves the file
  const json = require(resolve(__dirname, "../package.json"));

  /* c8 ignore start */
  if (!json.version) {
    throw new Error("Missing version in package.json");
  }
  /* c8 ignore stop */

  return json.version;
}
