export function getPackageVersion(pkg: string) {
  try {
    return require(`${pkg}/package.json`).version;
  } catch (error) {
    return null;
  }
}
