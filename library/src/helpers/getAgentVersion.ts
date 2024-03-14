import { resolve } from "path";

export function getAgentVersion(): string {
  const json = require(resolve(__dirname, "../../package.json"));

  if (!json.version) {
    throw new Error("Missing version in package.json");
  }

  return json.version;
}
