import { sep } from "path";

export type ModulePathInfo = {
  /**
   * Name of the module, including the scope if it exists.
   */
  name: string;
  /**
   * Absolute path to the package inside node_modules.
   */
  base: string;
  /**
   * Relative path to required file inside the package folder.
   */
  path: string;
};

/**
 * Get the module name and dir from a path that is inside a node_modules folder.
 */
export function getModuleInfoFromPath(
  filePath: string
): ModulePathInfo | undefined {
  let _filePath = filePath;
  if (_filePath.startsWith("file://")) {
    _filePath = filePath.slice(7);
  }

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
    path: segments.slice(i + offset).join(sep),
  };
}
