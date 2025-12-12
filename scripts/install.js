const { fileExists, scanForSubDirsWithPackageJson } = require("./helpers/fs");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const { writeFile, mkdir, readFile } = require("fs/promises");
const { availableParallelism } = require("os");
const asyncPool = require("./helpers/asyncPool");
const execAsync = promisify(exec);

const projectRoot = join(__dirname, "..");
const majorNodeVersion = parseInt(process.version.split(".")[0].slice(1), 10);

const skipInstall = [
  { folder: "sample-apps/n8n", check: (major) => major >= 24 },
];

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
  const e2eOnly = process.argv.includes("--end2end-only");
  const benchmarksOnly = process.argv.includes("--benchmarks-only");
  const installAll = !libOnly && !e2eOnly && !benchmarksOnly;

  const installDirs = [];
  const scanForSubDirs = [];

  if (installAll) {
    installDirs.push("library", "end2end");
    scanForSubDirs.push("sample-apps", "benchmarks");
  } else {
    // . is the root directory, npm install is automatically run in the root directory if npm install is used,
    // but not if npm run install-xxx is used
    installDirs.push(".");
    if (libOnly) installDirs.push("library");
    if (e2eOnly) installDirs.push("end2end");
    if (benchmarksOnly) scanForSubDirs.push("benchmarks");
    if (e2eOnly) scanForSubDirs.push("sample-apps");
  }

  for (const dir of scanForSubDirs) {
    const subDirs = await scanForSubDirsWithPackageJson(dir);
    installDirs.push(...subDirs);
  }

  await asyncPool(getParallelism(), installDirs, installDependencies);

  console.log("Successfully installed all dependencies");
  process.exit(0);
}

/**
 * Install dependencies for a given folder
 */
async function installDependencies(folder) {
  console.log(`Installing dependencies for ${folder}`);

  if (
    skipInstall.some(
      (entry) => entry.folder === folder && entry.check(majorNodeVersion)
    )
  ) {
    console.log(
      `Skipping installation for ${folder} due to Node.js version check`
    );
    return;
  }

  // Don't run potentially unsafe scripts during installation
  const flags = "--ignore-scripts";
  const cmd = process.env.CI ? `npm ci ${flags}` : `npm install ${flags}`;

  try {
    await execAsync(cmd, {
      cwd: join(projectRoot, folder),
      env: {
        ...process.env,
        AIKIDO_SKIP_INSTALL: "true",
      },
    });
    await rebuildNativePackages(folder);
    console.log(`Installed dependencies for ${folder}`);
  } catch (error) {
    console.error(`Failed to install dependencies for ${folder}`);
    console.error(error);
    process.exit(1);
  }
}

/**
 * We need to manually rebuild native packages (the ones we trust)
 * Because we installed dependencies with --ignore-scripts flag
 */
async function rebuildNativePackages(folder) {
  const packageJsonPath = join(projectRoot, folder, "package.json");

  if (!(await fileExists(packageJsonPath))) {
    return;
  }

  const buffer = await readFile(packageJsonPath, "utf-8");
  const pkg = JSON.parse(buffer);
  const allDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const nativePackages = ["sqlite3", "better-sqlite3"];
  const packagesToRebuild = nativePackages.filter((pkgName) =>
    allDeps.has(pkgName)
  );

  if (packagesToRebuild.length > 0) {
    console.log(
      `Rebuilding native packages for ${folder}: ${packagesToRebuild.join(", ")}`
    );

    for (const pkgName of packagesToRebuild) {
      const packagePath = join(projectRoot, folder, "node_modules", pkgName);

      if (pkgName === "sqlite3") {
        try {
          await execAsync("../.bin/prebuild-install -r napi", {
            cwd: packagePath,
          });
        } catch (error) {
          console.error(
            `prebuild-install failed for ${pkgName} in ${folder}: ${error.message}, falling back to node-gyp rebuild`
          );
          try {
            await execAsync("node-gyp rebuild", {
              cwd: packagePath,
            });
          } catch (error) {
            console.error(
              `❌ node-gyp rebuild failed for ${pkgName} in ${folder}: ${error.message}`
            );
          }
        }
      }

      if (pkgName === "better-sqlite3") {
        try {
          await execAsync("../.bin/prebuild-install", {
            cwd: packagePath,
          });
        } catch (error) {
          console.error(
            `prebuild-install failed for ${pkgName} in ${folder}: ${error.message}, falling back to node-gyp rebuild`
          );
          try {
            await execAsync("node-gyp rebuild --release", {
              cwd: packagePath,
            });
          } catch (error) {
            console.error(
              `❌ node-gyp rebuild failed for ${pkgName} in ${folder}: ${error.message}`
            );
          }
        }
      }
    }
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

function getParallelism() {
  // Function not available in Node.js v16
  if (typeof availableParallelism !== "function") {
    return 4;
  }
  return availableParallelism();
}
