const { readdir, stat } = require("fs/promises");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function main() {
  const sampleApps = await readdir(join(__dirname, "../sample-apps"));

  await Promise.all(
    sampleApps.map(async (file) => {
      const stats = await stat(join(__dirname, "../sample-apps", file));

      if (!stats.isFile()) {
        await installSampleAppDeps(file);
      }
    })
  );

  const benchmarks = await readdir(join(__dirname, "../benchmarks"));

  await Promise.all(
    benchmarks.map(async (file) => {
      const stats = await stat(join(__dirname, "../benchmarks", file));

      if (!stats.isFile()) {
        await installBenchmarkDeps(file);
      }
    })
  );
}

async function installSampleAppDeps(sampleApp) {
  console.log(`Installing dependencies for ${sampleApp}`);

  try {
    await execAsync(`npm install`, {
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
    await execAsync(`npm install`, {
      cwd: join(__dirname, "../benchmarks", benchmark),
    });
    console.log(`Dependencies installed for ${benchmark}`);
  } catch (error) {
    console.error(`Failed to install dependencies for ${benchmark}`);
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
