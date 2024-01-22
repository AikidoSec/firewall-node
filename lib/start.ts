import { Http } from "./packages/http";
import { MongoDB } from "./packages/mongodb";

export function start() {
  const packages = [new MongoDB(), new Http()];

  packages.forEach((p) => p.patch());
}
