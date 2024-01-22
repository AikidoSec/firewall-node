import { Express } from "./packages/express";
import { MongoDB } from "./packages/mongodb";

export function bootstrap() {
  const packages = [new MongoDB(), new Express()];

  packages.forEach((p) => p.patch());
}
