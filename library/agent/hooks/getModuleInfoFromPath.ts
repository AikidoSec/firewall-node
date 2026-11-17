import { sep } from "path";
import { fileURLToPath } from "url";

export type ModulePathInfo = {
  /**
   * Name of the module, including the scope if it exists.
   */
  name: string;
  /**
   * Absolute path to the package inside node_modules (native path separators).
   */
  base: string;
  /**
   * Relative path to required file inside the package folder.
   * Always uses forward slashes, independent of the platform.
   */
  path: string;
};

function fileUrlToPath(url: string): string {
  try {
    return fileURLToPath(url);
  } catch {
    return url.slice(7);
  }
}

/**
 * Get the module name and dir from a path that is inside a node_modules folder.
 */
export function getModuleInfoFromPath(
  filePath: string
): ModulePathInfo | undefined {
  const _filePath = filePath.startsWith("file://")
    ? fileUrlToPath(filePath)
    : filePath;

  const segments = _filePath.split(sep);
  const i = segments.lastIndexOf("node_modules");

  if (i === -1 || i + 1 >= segments.length) {
    return undefined;
  }

  const isScoped = segments[i + 1][0] === "@";

  const name = isScoped
    ? segments[i + 1] + "/" + segments[i + 2]
    : segments[i + 1];

  const offset = isScoped ? 3 : 2;

  return {
    name: name,
    base: segments.slice(0, i + offset).join(sep),
    path: segments.slice(i + offset).join("/"),
  };
}
