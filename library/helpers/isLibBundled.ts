import { sep } from "path";

// Detect at runtime if the library is bundled inside an application
export function isLibBundled(): boolean {
  return (
    !__dirname.includes(`node_modules${sep}@aikidosec${sep}firewall${sep}`) &&
    // In case of e2e tests where we import from build folder directly
    !(
      __dirname.endsWith(`${sep}build${sep}helpers`) ||
      __dirname.endsWith(`${sep}build`)
    )
  );
}
