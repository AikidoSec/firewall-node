/**
 * Convert a fs path argument (string, Buffer, URL) to a string
 */
export function pathToString(path: string | Buffer | URL): string | undefined {
  if (typeof path === "string") {
    return path;
  }

  if (path instanceof URL) {
    return path.pathname;
  }

  if (path instanceof Buffer) {
    try {
      return new TextDecoder("utf-8", {
        fatal: true,
      }).decode(path);
    } catch (e) {
      return undefined;
    }
  }

  return undefined;
}
