import { MongoDB } from "./packages/mongodb";

export function start() {
  const packages = [new MongoDB()];

  packages.forEach((p) => p.patch());
}
