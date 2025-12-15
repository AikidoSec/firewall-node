import { sep } from "path";

// Detect at runtime if the library is bundled inside an application
export function isLibBundled(): boolean {
  return (
    !__filename.includes(
      `node_modules${sep}@aikidosec${sep}firewall${sep}isLibBundled`
    ) && !__filename.includes(`${sep}build${sep}isLibBundled`) // In case of e2e tests
  );
}
