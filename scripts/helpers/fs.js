const { readdir, access, constants } = require("fs/promises");
const { join } = require("path");

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check for subdirectories with a package.json file in the given directory
 */
async function scanForSubDirsWithPackageJson(dir) {
  const dirPath = join(__dirname, "../..", dir);
  const files = await readdir(dirPath, { withFileTypes: true });

  const results = [];

  for (const file of files) {
    if (file.isDirectory()) {
      const packageJsonPath = join(dirPath, file.name, "package.json");
      if (await fileExists(packageJsonPath)) {
        results.push(join(dir, file.name));
      }
    }
  }

  return results;
}

/**
 * Recursively find files with a specific extension in the given directory
 */
async function findFilesWithExtension(dir, extension) {
  const result = [];

  async function walk(currentDir) {
    const entries = await readdir(currentDir, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath); // Recurse into subdirectory
      } else if (entry.isFile() && fullPath.endsWith(extension)) {
        result.push(fullPath); // Add file to the result list
      }
    }
  }

  await walk(dir);
  return result;
}

module.exports = {
  fileExists,
  scanForSubDirsWithPackageJson,
  findFilesWithExtension,
};
