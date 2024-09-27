import type { PackageJson } from "type-fest";
import type { ModulePathInfo } from "./getModuleInfoFromPath";
import { resolve } from "path";
import { isPlainObject } from "../../helpers/isPlainObject";

/**
 * This function checks if the required file is the main file of the package.
 * It does this by checking the package.json file of the package.
 */
export function isMainJsFile(
  pathInfo: ModulePathInfo,
  requireId: string | undefined,
  filename: string,
  packageJson: PackageJson,
  esmImport = false
) {
  // If the name of the package is the same as the requireId (the argument passed to require), then it is the main file
  if (pathInfo.name === requireId) {
    return true;
  }

  // Todo package.json could contain filename without default extension .js

  // Check package.json main field
  if (
    typeof packageJson.main === "string" &&
    resolve(pathInfo.base, packageJson.main) === filename
  ) {
    return true;
  }

  // Defaults to index.js if main field is not set
  if (packageJson.main === undefined) {
    if (resolve(pathInfo.base, "index.js") === filename) {
      return true;
    }
  }

  // Check exports field
  return doesMainExportMatchFilename(
    packageJson.exports,
    pathInfo.base,
    filename,
    esmImport
  );
}

/**
 * This function checks if the main package exported js file is the same as the passed file.
 */
function doesMainExportMatchFilename(
  exportsField: PackageJson["exports"],
  base: string,
  filename: string,
  esmImport: boolean
) {
  if (!exportsField) {
    return false;
  }

  const allowedExportConditions = ["default", "node", "node-addons"];
  if (!esmImport) {
    allowedExportConditions.push("require");
  } else {
    allowedExportConditions.push("import");
  }

  if (typeof exportsField === "string") {
    if (resolve(base, exportsField) === filename) {
      return true;
    }
  }

  if (Array.isArray(exportsField)) {
    for (const value of exportsField) {
      if (typeof value === "string" && resolve(base, value) === filename) {
        return true;
      }
    }
  } else if (isPlainObject(exportsField)) {
    for (const [key, value] of Object.entries(exportsField)) {
      // Todo check specification for index.mjs if esm
      if ([".", "./", "./index.js"].includes(key)) {
        if (typeof value === "string" && resolve(base, value) === filename) {
          return true;
        }
        if (isPlainObject(value)) {
          for (const condition of allowedExportConditions) {
            if (
              condition in value &&
              typeof value[condition] === "string" &&
              resolve(base, value[condition]) === filename
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}
