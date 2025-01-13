const { readdir, stat, access, constants } = require("fs/promises");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

function getInstallCmd() {
  if (process.env.CI) {
    return "npm ci";
  }
  return "npm install";
}

async function main() {
  const sampleAppsDir = join(__dirname, "../sample-apps");
  const sampleApps = await readdir(sampleAppsDir);

  await Promise.all(
    sampleApps.map(async (file) => {
      const stats = await stat(join(sampleAppsDir, file));

      if (
        !stats.isFile() &&
        (await fileExists(join(sampleAppsDir, file, "package.json")))
      ) {
        await installSampleAppDeps(file);
      }
    })
  );

  const benchmarksDir = join(__dirname, "../benchmarks");
  const benchmarks = await readdir(benchmarksDir);

  await Promise.all(
    benchmarks.map(async (file) => {
      const stats = await stat(join(benchmarksDir, file));

      if (
        !stats.isFile() &&
        (await fileExists(join(benchmarksDir, file, "package.json")))
      ) {
        await installBenchmarkDeps(file);
      }
    })
  );
}

async function installSampleAppDeps(sampleApp) {
  console.log(`Installing dependencies for ${sampleApp}`);

  try {
    await execAsync(getInstallCmd(), {
      cwd: join(__dirname, "../sample-apps", sampleApp),
    });
    console.log(`Dependencies installed for ${sampleApp}`);
  } catch (error) {
    console.error(`Failed to install dependencies for ${sampleApp}`);
    console.error(error);
    process.exit(1);
  }
}

async function installBenchmarkDeps(benchmark) {
  console.log(`Installing dependencies for ${benchmark}`);

  try {
    await execAsync(getInstallCmd(), {
      cwd: join(__dirname, "../benchmarks", benchmark),
    });
    console.log(`Dependencies installed for ${benchmark}`);
  } catch (error) {
    console.error(`Failed to install dependencies for ${benchmark}`);
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

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
