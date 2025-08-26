const { fileExists, scanForSubDirsWithPackageJson } = require("./helpers/fs");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const { writeFile, mkdir } = require("fs/promises");
const { availableParallelism } = require("os");
const asyncPool = require("./helpers/asyncPool");
const execAsync = promisify(exec);

const projectRoot = join(__dirname, "..");

// If script is called with arg --ci, set env CI to true
if (process.argv.includes("--ci")) {
  process.env.CI = "true";
}

if (process.env.AIKIDO_SKIP_INSTALL === "true") {
  console.log("Skipping dependencies installation");
  process.exit(0);
}

async function main() {
  await prepareBuildDir();

  const libOnly = process.argv.includes("--lib-only");

  // . is the root directory, npm install is automatically run in the root directory if npm install is used, but not if npm run install-lib-only is executed
  const installDirs = libOnly ? ["library", "."] : ["library", "end2end"];
  const scanForSubDirs = libOnly ? [] : ["sample-apps", "benchmarks"];

  for (const dir of scanForSubDirs) {
    const subDirs = await scanForSubDirsWithPackageJson(dir);
    installDirs.push(...subDirs);
  }

  await asyncPool(availableParallelism(), installDirs, installDependencies);

  console.log("Successfully installed all dependencies");
  process.exit(0);
}

/**
 * Install dependencies for a given folder
 */
async function installDependencies(folder) {
  console.log(`Installing dependencies for ${folder}`);

  const cmd = process.env.CI ? "npm ci" : "npm install";

  try {
    await execAsync(cmd, {
      cwd: join(projectRoot, folder),
      env: {
        ...process.env,
        AIKIDO_SKIP_INSTALL: "true",
      },
    });
    console.log(`Installed dependencies for ${folder}`);
  } catch (error) {
    console.error(`Failed to install dependencies for ${folder}`);
    console.error(error);
    process.exit(1);
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
  } catch (error) {
    console.error(`Failed to prepare build directory`);
    console.error(error);
    process.exit(1);
  }
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
