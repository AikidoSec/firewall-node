// Detect at runtime if the library is bundled inside an application
export function isLibBundled(): boolean {
  return (
    !__dirname.includes("node_modules/@aikidosec/firewall/helpers") &&
    !__dirname.includes("firewall-node/build/helpers") // In case of e2e tests
  );
}
