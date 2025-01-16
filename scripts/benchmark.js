const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);
const { scanForSubDirsWithPackageJson } = require("./helpers/fs");
const { join } = require("path");

async function main() {
  const benchmarks = await scanForSubDirsWithPackageJson("benchmarks");

  for (const benchmark of benchmarks) {
    console.log(`Running ${benchmark}`);
    const output = await execAsync("node benchmark.js", {
      cwd: join(__dirname, "..", benchmark),
      env: {
        ...process.env,
        AIKIDO_CI: "true",
      },
    });
    console.log(output.stdout);
    console.error(output.stderr);
    console.log(`Finished running ${benchmark}`);
  }
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
  }
})();
