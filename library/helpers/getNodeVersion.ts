export function getNodeVersionStr(): string {
  return process.version;
}

export function getMajorNodeVersion(): number {
  return parseInt(getNodeVersionStr().split(".")[0].slice(1));
}
