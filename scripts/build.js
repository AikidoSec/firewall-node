const { rm, copyFile, cp, mkdir, readFile, writeFile } = require("fs/promises");
const { join } = require("path");
const { exec } = require("child_process");
const { fileExists, findFilesWithExtension } = require("./helpers/fs");
const {
  downloadFile,
  verifyFileHash,
  extractTar,
} = require("./helpers/internals");

// Helper to run exec async and pipe stdout/stderr
async function execAsyncWithPipe(command, options) {
  const child = exec(command, options);
  child.stdout && child.stdout.pipe(process.stdout);
  child.stderr && child.stderr.pipe(process.stderr);
  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${command} (exit code ${code})`));
    });
    child.on("error", reject);
  });
}

// Zen Internals configuration
const INTERNALS_VERSION = "v0.1.60";
const INTERNALS_URL = `https://github.com/AikidoSec/zen-internals/releases/download/${INTERNALS_VERSION}`;
// ---

// Node Internals configuration
const NODE_INTERNALS_VERSION = "1.0.1";
const NODE_INTERNALS_URL = `https://github.com/AikidoSec/zen-internals-node/releases/download/${NODE_INTERNALS_VERSION}`;
// 17 is not included on purpose
const NODE_VERSIONS = [16, 18, 19, 20, 21, 22, 23, 24, 25];
// ---

const rootDir = join(__dirname, "..");
const buildDir = join(rootDir, "build");
const libDir = join(rootDir, "library");
const internalsDir = join(libDir, "internals");
const nodeInternalsDir = join(libDir, "node_internals");
const instrumentationWasmDir = join(rootDir, "instrumentation-wasm");
const instrumentationWasmOutDir = join(
  libDir,
  "agent",
  "hooks",
  "instrumentation",
  "wasm"
);

async function main() {
  // Delete build directory if it exists
  if (await fileExists(buildDir)) {
    await rm(buildDir, { recursive: true });
  }

  await dlZenInternals();
  await buildInstrumentationWasm();
  await dlNodeInternals();

  if (process.argv.includes("--only-wasm")) {
    console.log("Built only WASM files as requested.");
    process.exit(0);
  }

  await execAsyncWithPipe(`npm run build`, {
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
  await copyFile(
    join(internalsDir, "zen_internals_bg.wasm"),
    join(buildDir, "internals", "zen_internals_bg.wasm")
  );
  await cp(nodeInternalsDir, join(buildDir, "node_internals"), {
    recursive: true,
  });
  // Remove .gitignore so npm doesn't exclude .node files during publish
  await rm(join(buildDir, "node_internals", ".gitignore"));
  await rm(join(buildDir, "node_internals", ".installed_version"));
  await copyFile(
    join(instrumentationWasmOutDir, "node_code_instrumentation_bg.wasm"),
    join(
      buildDir,
      "agent",
      "hooks",
      "instrumentation",
      "wasm",
      "node_code_instrumentation_bg.wasm"
    )
  );

  await modifyDtsFilesAfterBuild();

  console.log("Build successful");
  process.exit(0);
}

async function dlNodeInternals() {
  await mkdir(nodeInternalsDir, { recursive: true });

  // Check if the wanted version of Node Internals is already installed
  const versionCacheFile = join(nodeInternalsDir, ".installed_version");
  const installedVersion = (await fileExists(versionCacheFile))
    ? await readFile(versionCacheFile, "utf8")
    : null;
  if (installedVersion === NODE_INTERNALS_VERSION) {
    console.log("Node Internals already installed. Skipping download.");
    return;
  }

  const downloads = [];
  for (const nodeVersion of NODE_VERSIONS) {
    for (const platform of ["linux", "darwin", "win32"]) {
      let archs = ["x64", "arm64"];
      if (platform === "win32") {
        // Only x64 builds are available for Windows
        archs = ["x64"];
      }
      if (nodeVersion === 16) {
        // Only x64 builds are available for Node 16
        archs = ["x64"];
      }
      for (const arch of archs) {
        // zen-internals-node-linux-x64-node20.node
        const filename = `zen-internals-node-${platform}-${arch}-node${nodeVersion}.node`;
        const url = `${NODE_INTERNALS_URL}/${filename}`;
        const destPath = join(nodeInternalsDir, filename);

        console.log(
          `Downloading Node Internals for Node ${nodeVersion} ${platform} ${arch}...`
        );
        downloads.push(downloadFile(url, destPath));

        // zen-internals-node-linux-x64-musl-node20.node
        const muslFilename = `zen-internals-node-${platform}-${arch}-musl-node${nodeVersion}.node`;
        const muslUrl = `${NODE_INTERNALS_URL}/${muslFilename}`;
        const muslDestPath = join(nodeInternalsDir, muslFilename);

        console.log(
          `Downloading Node Internals for Node ${nodeVersion} ${platform} ${arch} (musl)...`
        );
        downloads.push(downloadFile(muslUrl, muslDestPath));
      }
    }
  }

  await Promise.all(downloads);

  await writeFile(versionCacheFile, NODE_INTERNALS_VERSION);
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
  console.log("Downloading Zen Internals...");

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

  await writeFile(versionCacheFile, INTERNALS_VERSION);
}

async function modifyDtsFilesAfterBuild() {
  // import type { Express, Router } from "express";
  //                                       ^^^^^^^
  // We reference express types, but we don't have it as a dependency
  // If the user has `"skipLibCheck": false` in their tsconfig.json, TypeScript will complain when express is not installed
  // If the user has `"skipLibCheck": true` in their tsconfig.json, it's fine
  //
  // Search all d.ts files in the build directory, and replace /** TS_EXPECT_TYPES_ERROR_OPTIONAL_DEPENDENCY **/
  // The // @ts-ignore comments are not added to .d.ts files if they are inside the code, only JSDoc comments are added
  // That's why we need to replace a JSDoc comment with a // @ts-ignore comment
  const dtsFiles = await findFilesWithExtension(buildDir, ".d.ts");
  for (const dtsFile of dtsFiles) {
    const content = await readFile(dtsFile, "utf8");
    const modifiedContent = content.replaceAll(
      "/** TS_EXPECT_TYPES_ERROR_OPTIONAL_DEPENDENCY **/",
      "// @ts-ignore"
    );

    // Write modified content back to the file if it was changed
    if (content !== modifiedContent) {
      await writeFile(dtsFile, modifiedContent);
    }
  }
}

async function buildInstrumentationWasm() {
  // Build Instrumentation WASM
  await execAsyncWithPipe(
    `wasm-pack build --release --target nodejs --out-dir ${instrumentationWasmOutDir}`,
    {
      cwd: instrumentationWasmDir,
    }
  );

  // Delete .d.ts files generated by wasm-pack
  await rm(join(instrumentationWasmOutDir, "node_code_instrumentation.d.ts"));
  await rm(
    join(instrumentationWasmOutDir, "node_code_instrumentation_bg.wasm.d.ts")
  );
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
