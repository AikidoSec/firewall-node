export function getMajorNodeVersion(): number {
  return parseInt(process.version.split(".")[0].slice(1));
}

export function getMinorNodeVersion() {
  return parseInt(process.version.split(".")[1]);
}

export function getSemverNodeVersion() {
  return process.version.startsWith("v")
    ? process.version.slice(1)
    : process.version;
}
