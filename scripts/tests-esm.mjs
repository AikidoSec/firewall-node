import {
  mkdir,
  glob,
  writeFile,
  rm,
  readFile,
  copyFile,
  cp,
} from "fs/promises";
import { dirname, join, resolve } from "path";
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
const libBuildDir = join(import.meta.dirname, "../build");
const libOutDir = join(outDir, "library");
const testsOutDir = join(outDir, "tests");

if (existsSync(outDir)) {
  await rm(outDir, { recursive: true, force: true });
}

await cp(libBuildDir, libOutDir, { recursive: true });

const testFiles = glob("**/*.{test.ts,txt}", {
  cwd: libDir,
  exclude: ["**/node_modules/**"],
});

// Copy all test files
for await (const entry of testFiles) {
  const src = join(libDir, entry);
  let dest = join(testsOutDir, entry);

  await mkdir(dirname(dest), { recursive: true });

  if (entry.endsWith(".txt")) {
    await copyFile(src, dest);
    continue;
  }

  let content = await readFile(src, "utf8");

  if (content.includes("// @esm-tests-skip")) {
    continue;
  }

  // Fix default imports
  content = content.replace(
    /import\s+(\w+)\s+from\s+['"](\.[^'"]*)['"];?/g,
    (match, p1, p2) => {
      return `import ____${p1} from '${p2}'; const ${p1} = ____${p1}.default;`;
    }
  );

  // Modify all relative imports
  content = content.replace(/from\s+['"](\.[^'"]*)['"]/g, (match, p1) => {
    const newPath = resolve(dirname(dest), p1).replace(
      ".esm-tests/tests/",
      ".esm-tests/library/"
    );

    return `from '${newPath}.js'`;
  });

  content = content.replaceAll(
    'import * as t from "tap";',
    'import t from "tap";'
  );

  content = content.replaceAll("__dirname", "import.meta.dirname");

  content = content.replaceAll("require(", "await import(");

  await writeFile(dest, content);
}

// Create package.json with type module to run tap as ESM
await writeFile(
  join(testsOutDir, "package.json"),
  JSON.stringify(
    {
      type: "module",
    },
    null,
    2
  )
);

await writeFile(
  join(testsOutDir, "tsconfig.json"),
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

await execAsyncWithPipe("ln -s ../../library/node_modules node_modules", {
  cwd: testsOutDir,
});

await execAsyncWithPipe("ln -s ../../library/node_modules node_modules", {
  cwd: libOutDir,
});

await execAsyncWithPipe(
  "npx tap --disable-coverage helpers/shouldEnableFirewall.test.ts",
  {
    env: {
      CI: true,
      AIKIDO_TEST_NEW_INSTRUMENTATION: "true",
      AIKIDO_CI: "true",
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
      IS_ESM_TEST: true,
      ...process.env,
    },
    cwd: testsOutDir,
  }
);
