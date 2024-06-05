export function isPackageInstalled(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch (e) {
    return false;
  }
}
