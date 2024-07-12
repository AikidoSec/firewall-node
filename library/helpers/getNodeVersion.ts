export function getMajorNodeVersion(): number {
  return parseInt(process.version.split(".")[0].slice(1));
}
