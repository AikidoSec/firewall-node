import { copyFile, cp, glob, mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const libDir = join(import.meta.dirname, "..", "library");

// This is a workaround to import TypeScript files from a directory
// with a package.json that has "type": "commonjs".
const tempDir = await mkdtemp(join(tmpdir(), "zen-unsupported-check-"));
await copyFile(
  join(libDir, "helpers", "satisfiesVersion.ts"),
  join(tempDir, "satisfiesVersion.mts")
);

const { satisfiesVersion } = await import(
  join(tempDir, "satisfiesVersion.mts")
);
// --- end workaround

const skipChecksFor = ["Lambda.ts", "Fetch.ts", "FunctionSink.ts"];

console.info(
  "Checking for newer unsupported package versions for all sinks and sources..."
);

const filesToCheck: string[] = [];

function isSinkOrSource(path: string): boolean {
  if (path.endsWith(".test.ts") || path.endsWith(".tests.ts")) {
    return false;
  }
  return true;
}

for await (const sourcePath of glob(`${libDir}/sources/*.ts`)) {
  if (isSinkOrSource(sourcePath)) {
    filesToCheck.push(sourcePath);
  }
}

for await (const sinkPath of glob(`${libDir}/sinks/*.ts`)) {
  if (isSinkOrSource(sinkPath)) {
    filesToCheck.push(sinkPath);
  }
}

console.info(`Found ${filesToCheck.length} files to check...`);

const supportedVersionRanges = new Map<string, string>();

for (const filePath of filesToCheck) {
  const fileContent = await readFile(filePath, "utf-8");

  if (fileContent.includes(".addBuiltinModule(")) {
    continue; // Skip builtin modules as they don't have versions
  }

  if (skipChecksFor.some((skipFile) => filePath.endsWith(skipFile))) {
    console.info(`Skipping unsupported version check for ${filePath}...`);
    continue;
  }

  let foundMatch = false;
  const regex = /\.addPackage\("([^"]+)"\)\s*\.withVersion\("([^"]+)"\)/g;
  let match;
  while ((match = regex.exec(fileContent)) !== null) {
    foundMatch = true;
    const packageName = match[1];
    const packageVersion = match[2];
    if (!supportedVersionRanges.has(packageName)) {
      supportedVersionRanges.set(packageName, packageVersion);
    } else {
      const existingVersion = supportedVersionRanges.get(packageName)!;
      supportedVersionRanges.set(
        packageName,
        existingVersion + "||" + packageVersion
      );
    }
  }

  if (!foundMatch) {
    console.error(
      `Warning: No .addPackage(...).withVersion(...) pattern found in ${filePath}`
    );
  }
}

console.info(
  `Successfully extracted latest supported versions for ${supportedVersionRanges.size} packages.`
);

console.info(
  "Checking for newer versions on npm registry. This can take a while..."
);
for (const [packageName, version] of supportedVersionRanges.entries()) {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`
    );
    if (!response.ok) {
      console.error(
        `Failed to fetch latest version for package ${packageName}: ${response.statusText}`
      );
      continue;
    }
    const data = await response.json();
    const latestVersion = data.version;
    if (!satisfiesVersion(version, latestVersion)) {
      console.warn(
        `Package ${packageName} has a newer version ${latestVersion} that is not supported (supported: ${version})`
      );
    }
  } catch (err: any) {
    console.error(
      `Error checking latest version for package ${packageName}: ${err.message}`
    );
  }
}

console.info("Finished checking for newer unsupported package versions.");

await rm(tempDir, { recursive: true, force: true });
