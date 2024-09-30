const { existsSync } = require("fs");
const { rm, copyFile } = require("fs/promises");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function main() {
  const rootDir = join(__dirname, "..");
  const buildDir = join(rootDir, "build");
  const libDir = join(rootDir, "library");

  // Delete build directory if it exists
  if (existsSync(buildDir)) {
    await rm(buildDir, { recursive: true });
  }

  await execAsync(`npm run build`, {
    cwd: libDir,
  });

  // Copy additional files to build directory
  await copyFile(
    join(rootDir, "library", "package.json"),
    join(buildDir, "package.json")
  );
  await copyFile(join(rootDir, "README.md"), join(buildDir, "README.md"));
  await copyFile(join(rootDir, "LICENSE"), join(buildDir, "LICENSE"));

  console.log("Build successful");
  process.exit(0);
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
