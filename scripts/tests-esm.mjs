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
import { parseSync } from "oxc-parser";
import { generate } from "astring";
import { transform } from "oxc-transform";
import { walk } from "oxc-walker";

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

// Copy all test files and transform them
for await (const entry of testFiles) {
  const src = join(libDir, entry);
  const dest = join(testsOutDir, entry.replace(/ts$/, "js"));

  await mkdir(dirname(dest), { recursive: true });

  if (entry.endsWith(".txt")) {
    await copyFile(src, dest);
    continue;
  }

  const sourceText = await readFile(src, "utf8");

  if (sourceText.includes("// @esm-tests-skip")) {
    continue;
  }

  const filename = entry.split("/").pop();
  const newFilename = filename.replace(/ts$/, "js");

  // --------------- Transform TS to JS and parse to AST ----------------
  const { code, errors } = transform(filename, sourceText, {
    target: "es2022",
    typescript: {
      rewriteImportExtensions: "rewrite",
    },
  });

  if (errors.length) {
    console.error(`Errors in ${entry}:`);
    for (const error of errors) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const ast = parseSync(newFilename, code, {
    preserveParens: false,
  });

  // --------------- Traverse the AST ---------------

  // https://www.npmjs.com/package/oxc-walker
  walk(ast.program, {
    enter(node) {
      if (node.type === "ImportDeclaration") {
        const importNode = node;
        const source = importNode.source;

        if (source.value === "tap") {
          importNode.specifiers = [
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "test" },
              local: { type: "Identifier", name: "test" },
            },
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "describe" },
              local: { type: "Identifier", name: "describe" },
            },
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "before" },
              local: { type: "Identifier", name: "before" },
            },
          ];

          source.value = "node:test";
          source.raw = `'node:test'`;
        }

        // Only modify relative imports (those starting with ".")
        if (typeof source.value === "string" && source.value.startsWith(".")) {
          const newPath = resolve(dirname(dest), source.value).replace(
            ".esm-tests/tests/",
            ".esm-tests/library/"
          );

          // Update import source
          source.value = `${newPath}.js`;
          source.raw = `'${newPath}.js'`;
        }
      }
    },
  });

  await writeFile(dest, generate(ast.program));
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

await execAsyncWithPipe("ln -s ../../library/node_modules node_modules", {
  cwd: testsOutDir,
});

await execAsyncWithPipe("ln -s ../../library/node_modules node_modules", {
  cwd: libOutDir,
});

await execAsyncWithPipe(
  "node --test --test-concurrency 4 ./sources/Hono.test.js",
  {
    env: {
      CI: true,
      AIKIDO_TEST_NEW_INSTRUMENTATION: "true",
      AIKIDO_CI: "true",
      NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
      AIKIDO_ESM_TEST: true,
      ...process.env,
    },
    cwd: testsOutDir,
  }
);
