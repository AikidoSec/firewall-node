export function isAikidoCI(): boolean {
  return process.env.AIKIDO_CI === "true" || process.env.AIKIDO_CI === "1";
}
