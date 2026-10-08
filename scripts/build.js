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
const INTERNALS_VERSION = "v0.1.73";
const INTERNALS_URL = `https://github.com/AikidoSec/zen-internals/releases/download/${INTERNALS_VERSION}`;
// Repository-pinned checksum to prevent coordinated archive/checksum replacement attacks
// This checksum must be independently verified and updated whenever INTERNALS_VERSION changes
// To obtain and verify the legitimate checksum for a new version:
// 1. Download from multiple independent sources and compare
// 2. Verify the publisher's identity through GitHub's verified badge
// 3. Compute: sha256sum zen_internals.tgz
// 4. Cross-reference with the published .sha256sum file as a sanity check only
// 5. Update INTERNALS_SHA256 below with the verified checksum
//
// To obtain the checksum for the current version, run:
// node -e "const https = require('https'); https.get('https://github.com/AikidoSec/zen-internals/releases/download/v0.1.73/zen_internals.tgz.sha256sum', (res) => { let data = ''; res.on('data', (chunk) => { data += chunk; }); res.on('end', () => { console.log('Current published checksum:', data.split(' ')[0]); console.log('WARNING: Verify this checksum through multiple independent channels before pinning!'); }); });"
//
// SECURITY: This checksum is the trust anchor for the Zen Internals dependency.
// It must be verified through multiple independent channels before being committed.
const INTERNALS_SHA256 = ""; // Must be set to a valid SHA256 hex string (64 characters)
// ---

// Node Internals configuration
const NODE_INTERNALS_VERSION = "1.0.6";
const NODE_INTERNALS_URL = `https://github.com/AikidoSec/zen-internals-node/releases/download/${NODE_INTERNALS_VERSION}`;
// 17 is not included on purpose
const NODE_VERSIONS = [16, 18, 19, 20, 21, 22, 23, 24, 25, 26];
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

  // Copy package.json to build directory without devDependencies
  const packageJson = JSON.parse(
    await readFile(join(rootDir, "library", "package.json"), "utf8")
  );
  delete packageJson.devDependencies;
  delete packageJson.scripts;
  await writeFile(
    join(buildDir, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n"
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

  // Verify that a repository-pinned checksum is configured
  if (!INTERNALS_SHA256 || typeof INTERNALS_SHA256 !== "string" || INTERNALS_SHA256.length !== 64) {
    // Helper mode: download and display the current checksum for manual verification
    console.error("\n" + "=".repeat(80));
    console.error("ERROR: INTERNALS_SHA256 is not configured");
    console.error("=".repeat(80));
    console.error("\nFor security reasons, the Zen Internals checksum must be pinned in the");
    console.error("repository to prevent supply chain attacks.");
    console.error("\nTo obtain and verify the checksum:");
    console.error("1. Download the checksum file from the release:");
    console.error(`   curl -sL ${INTERNALS_URL}/${checksumFile}`);
    console.error("\n2. Download the archive and compute its checksum independently:");
    console.error(`   curl -sL ${INTERNALS_URL}/${tarballFile} | sha256sum`);
    console.error("\n3. Verify both checksums match and cross-reference through multiple channels");
    console.error("\n4. Update INTERNALS_SHA256 in scripts/build.js with the verified checksum");
    console.error("\nAttempting to download and compute checksum for reference...");
    
    try {
      // Download the archive
      await downloadFile(
        `${INTERNALS_URL}/${tarballFile}`,
        join(internalsDir, tarballFile)
      );
      
      // Compute its checksum
      const { createReadStream } = require("fs");
      const { createHash } = require("crypto");
      const { pipeline } = require("stream/promises");
      const input = createReadStream(join(internalsDir, tarballFile));
      const hashBuilder = createHash("sha256");
      await pipeline(input, hashBuilder);
      const computedChecksum = hashBuilder.digest("hex");
      
      // Also download the published checksum for comparison
      await downloadFile(
        `${INTERNALS_URL}/${checksumFile}`,
        join(internalsDir, checksumFile)
      );
      const publishedChecksum = (await readFile(join(internalsDir, checksumFile), "utf8")).split(" ")[0];
      
      console.error(`\nComputed checksum:  ${computedChecksum}`);
      console.error(`Published checksum: ${publishedChecksum}`);
      
      if (computedChecksum === publishedChecksum) {
        console.error("\n✓ Checksums match");
        console.error("\nTo fix this error, add the following line to scripts/build.js:");
        console.error(`const INTERNALS_SHA256 = "${computedChecksum}";`);
      } else {
        console.error("\n✗ WARNING: Checksums DO NOT match!");
        console.error("This could indicate a compromised release or download corruption.");
        console.error("DO NOT proceed without investigating this discrepancy.");
      }
      
      // Clean up
      await rm(join(internalsDir, tarballFile));
      await rm(join(internalsDir, checksumFile));
      
      console.error("\nWARNING: Verify this checksum through multiple independent channels");
      console.error("before pinning it in the repository!");
    } catch (error) {
      console.error("\nFailed to fetch and compute checksum:", error.message);
    }
    
    console.error("\n" + "=".repeat(80) + "\n");
    throw new Error(
      "INTERNALS_SHA256 must be set to a valid 64-character SHA256 hex string. " +
      "See error message above for instructions."
    );
  }

  await downloadFile(
    `${INTERNALS_URL}/${tarballFile}`,
    join(internalsDir, tarballFile)
  );
  
  // Verify against repository-pinned checksum (not a downloaded checksum file)
  console.log(`Verifying archive against pinned checksum: ${INTERNALS_SHA256}`);
  await verifyFileHash(join(internalsDir, tarballFile), INTERNALS_SHA256);
  console.log("Checksum verification passed");
  
  await extractTar(join(internalsDir, tarballFile), internalsDir);

  await rm(join(internalsDir, tarballFile));
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
