const { rm, copyFile, mkdir, readFile } = require("fs/promises");
const { join } = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const { fileExists } = require("./helpers/fs");
const {
  downloadFile,
  verifyFileHash,
  extractTar,
} = require("./helpers/internals");
const execAsync = promisify(exec);

// Zen Internals configuration
const INTERNALS_VERSION = "v0.1.35";
const INTERNALS_URL = `https://github.com/AikidoSec/zen-internals/releases/download/${INTERNALS_VERSION}`;
// ---

const rootDir = join(__dirname, "..");
const buildDir = join(rootDir, "build");
const libDir = join(rootDir, "library");
const internalsDir = join(libDir, "internals");

async function main() {
  // Delete build directory if it exists
  if (await fileExists(buildDir)) {
    await rm(buildDir, { recursive: true });
  }

  await dlZenInternals();

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
  await copyFile(
    join(internalsDir, "zen_internals_bg.wasm"),
    join(buildDir, "internals", "zen_internals_bg.wasm")
  );

  console.log("Build successful");
  process.exit(0);
}

// Download Zen Internals tarball and verify checksum
async function dlZenInternals() {
  const tarballFile = "zen_internals.tgz";
  const checksumFile = "zen_internals.tgz.sha256sum";

  await mkdir(internalsDir, { recursive: true });

  // Check if the wanted version of Zen Internals is already installed
  const versionCacheFile = join(internalsDir, ".installed_version");
  const installedVersion = (await fileExists(versionCacheFile))
    ? await readFile(versionCacheFile, "utf8")
    : null;
  if (installedVersion === INTERNALS_VERSION) {
    console.log("Zen Internals already installed. Skipping download.");
    return;
  }

  await downloadFile(
    `${INTERNALS_URL}/${tarballFile}`,
    join(internalsDir, tarballFile)
  );
  await downloadFile(
    `${INTERNALS_URL}/${checksumFile}`,
    join(internalsDir, checksumFile)
  );
  await verifyFileHash(join(internalsDir, tarballFile));
  await extractTar(join(internalsDir, tarballFile), internalsDir);

  await rm(join(internalsDir, tarballFile));
  await rm(join(internalsDir, checksumFile));
  await rm(join(internalsDir, "zen_internals.d.ts"));
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
