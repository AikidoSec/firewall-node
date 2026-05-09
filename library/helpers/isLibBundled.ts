// Detect at runtime if the library is bundled inside an application
export function isLibBundled(): boolean {
  // Replace Windows backslashes with forward slashes
  const normalizedDirName = __dirname.replace(/\\/g, "/");

  return (
    !normalizedDirName.includes("node_modules/@aikidosec/firewall/helpers") &&
    !normalizedDirName.includes("/build/helpers") // In case of e2e tests
  );
}
