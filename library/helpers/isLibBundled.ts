import { sep } from "path";

// Detect at runtime if the library is bundled inside an application
export function isLibBundled(): boolean {
  return (
    !__dirname.includes(`node_modules${sep}@aikidosec${sep}firewall`) &&
    !__dirname.includes(`firewall-node${sep}build`) // In case of e2e tests
  );
}
