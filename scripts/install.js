const { readdir, access, mkdir, writeFile, constants } = require("fs/promises");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const projectRoot = join(__dirname, "..");

async function main() {
  await prepareBuildDir();

  const installDirs = ["library", "end2end"];
  const scanForSubDirs = ["sample-apps", "benchmarks"];

  for (const dir of scanForSubDirs) {
    const subDirs = await scanForSubDirsWithPackageJson(dir);
    installDirs.push(...subDirs);
  }

  // Install dependencies for all directories
  for (const dir of installDirs) {
    await installDeps(dir);
  }

  console.log("Successfully installed all dependencies");
  process.exit(0);
}

/**
 * Install dependencies for a given folder
 */
async function installDeps(folder) {
  console.log(`Installing dependencies for ${folder}`);

  try {
    await execAsync(`npm install`, {
      cwd: join(projectRoot, folder),
    });
    console.log(`Installed dependencies for ${folder}`);
  } catch (error) {
    console.error(`Failed to install dependencies for ${folder}`);
    console.error(error);
    process.exit(1);
  }
}

async function fileExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepare the build directory
 */
async function prepareBuildDir() {
  try {
    const pkg = require(join(__dirname, "../library/package.json"));

    // We're going to remove the devDependencies from the package.json
    // Otherwise they will show up in every lock file
    // whenever we add a new dev dependency to the library
    delete pkg.devDependencies;

    // If the build folder doesn't exist, create it
    const buildDirPath = join(__dirname, "../build");
    if (!(await fileExists(buildDirPath))) {
      await mkdir(buildDirPath);
    }

    await writeFile(
      join(buildDirPath, "package.json"),
      JSON.stringify(pkg, null, 2)
    );

    // Create empty index.js file if it doesn't exist
    if (!(await fileExists(join(buildDirPath, "index.js")))) {
      await writeFile(join(buildDirPath, "index.js"), "");
    }

    // Link the library build folder
    await execAsync(`npm link`, {
      cwd: buildDirPath,
    });
  } catch (error) {
    console.error(`Failed to prepare build directory`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Check for subdirectories with a package.json file in the given directory
 */
async function scanForSubDirsWithPackageJson(dir) {
  const dirPath = join(projectRoot, dir);
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

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
