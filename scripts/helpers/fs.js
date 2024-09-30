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

module.exports = {
  fileExists,
  scanForSubDirsWithPackageJson,
};
