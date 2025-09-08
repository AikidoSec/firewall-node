import { mkdir, glob, writeFile, rm, readFile, copyFile } from "fs/promises";
import { dirname, join } from "path";
import { exec } from "child_process";
import { existsSync } from "fs";

const version = process.versions.node.split(".");
const major = parseInt(version[0], 10);

if (major !== 24) {
  console.error("Node.js version 24 is required");
  process.exit(1);
}

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

const libDir = join(import.meta.dirname, "../library");
const outDir = join(import.meta.dirname, "../.esm-tests");

if (existsSync(outDir)) {
  await rm(outDir, { recursive: true, force: true });
}

await mkdir(outDir, { recursive: true });

// Find all *test.ts files in libDir
const testFiles = glob("**/*.{ts,js,wasm}", {
  cwd: libDir,
  exclude: ["**/node_modules/**"],
});

// Copy all test files
for await (const entry of testFiles) {
  const src = join(libDir, entry);
  let dest = join(outDir, entry);

  if (src.endsWith(".wasm")) {
    await copyFile(src, dest);
    continue;
  }

  await mkdir(dirname(dest), { recursive: true });

  let content = await readFile(src, "utf8");

  // Modify all relative imports
  content = content.replace(/from\s+['"](\.[^'"]*)['"]/g, (match, p1) => {
    const ext =
      p1.includes("internals/zen_internals") ||
      p1.includes("wasm/node_code_instrumentation")
        ? ".cjs"
        : ".ts";

    return `from '${p1}${ext}'`;
  });

  content = content.replaceAll(
    'import * as t from "tap";',
    'import t from "tap";'
  );

  if (dest.endsWith(".js")) {
    dest = dest.replace(/\.js$/, ".cjs");
  } else {
    content = content.replace("__dirname", "import.meta.dirname");
  }

  await writeFile(dest, content);
}

// Create package.json with type module to run tap as ESM
await writeFile(
  join(outDir, "package.json"),
  JSON.stringify(
    {
      type: "module",
    },
    null,
    2
  )
);

await writeFile(
  join(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        module: "es2015",
        moduleResolution: "bundler",
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    },
    null,
    2
  )
);

await execAsyncWithPipe("ln -s ../library/node_modules node_modules", {
  cwd: outDir,
});

await execAsyncWithPipe("npx tap --disable-coverage", {
  env: {
    CI: true,
    AIKIDO_TEST_NEW_INSTRUMENTATION: "true",
    AIKIDO_CI: "true",
    NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    ...process.env,
  },
  cwd: outDir,
});
