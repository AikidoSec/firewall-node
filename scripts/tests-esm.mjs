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

if (major < 24) {
  console.error("Node.js version 24 or higher is required to run this script.");
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

await execAsyncWithPipe("./node_modules/.bin/tsc -p tsconfig.test.esm.json", {
  cwd: libDir,
});

await writeFile(join(outDir, "package.json"), "{}");

const testFiles = glob(
  "**/*.{test.ts,tests.ts,txt,pem,json,xml,js,prisma,toml,sql}",
  {
    cwd: libDir,
    exclude: ["**/node_modules/**"],
  }
);

// Copy all test files and transform them
for await (const entry of testFiles) {
  const src = join(libDir, entry);
  const dest = join(testsOutDir, entry.replace(/ts$/, "js"));

  await mkdir(dirname(dest), { recursive: true });

  if (
    ["txt", "pem", "json", "xml", "js", "prisma", "toml", "sql"].includes(
      entry.split(".").pop()
    )
  ) {
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
  let { code, errors } = transform(filename, sourceText, {
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

  // Fix imports
  code = code.replace(
    /import\s+(\w+)\s+from\s+['"](\.[^'"]*)['"];?/g,
    (match, p1, p2) => {
      return `import ____${p1} from '${p2}'; const ${p1} = ____${p1}.default;`;
    }
  );
  code = code.replaceAll(
    /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
    (match, p1, p2) => {
      return `import ${p1} from '${p2}';`;
    }
  );

  code =
    `import * as _testHelpers from '${join(import.meta.dirname, "helpers", "test-helpers.mjs")}';\n` +
    code;

  const ast = parseSync(newFilename, code, {
    preserveParens: false,
  });

  // --------------- Traverse the AST ---------------

  // https://www.npmjs.com/package/oxc-walker
  walk(ast.program, {
    enter(node) {
      if (node.type === "ImportDeclaration") {
        const source = node.source;

        if (source.value === "tap") {
          node.specifiers = [
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "test" },
              local: { type: "Identifier", name: "test" },
            },
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "beforeEach" },
              local: { type: "Identifier", name: "beforeEach" },
            },
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "before" },
              local: { type: "Identifier", name: "before" },
            },
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "after" },
              local: { type: "Identifier", name: "after" },
            },
            {
              type: "ImportSpecifier",
              imported: { type: "Identifier", name: "afterEach" },
              local: { type: "Identifier", name: "afterEach" },
            },
          ];

          source.value = "node:test";
          source.raw = `'node:test'`;
        }

        // Only modify relative imports (those starting with ".")
        if (typeof source.value === "string" && source.value.startsWith(".")) {
          const isTestFile = source.value.endsWith(".tests");
          const newPath = resolve(dirname(dest), source.value).replace(
            ".esm-tests/tests/",
            isTestFile ? ".esm-tests/tests/" : ".esm-tests/library/"
          );

          // Update import source
          source.value = `${newPath}.js`;
          source.raw = `'${newPath}.js'`;
        }
      }
      // CallExpression nodes
      if (node.type === "CallExpression") {
        // Replace t.test(...) and test assertions
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "t" &&
          node.callee.property.type === "Identifier"
        ) {
          switch (node.callee.property.name) {
            case "test":
              node.callee = { type: "Identifier", name: "test" };
              const testCb = node.arguments.find(
                (arg) =>
                  arg.type === "FunctionExpression" ||
                  arg.type === "ArrowFunctionExpression"
              );
              if (!testCb) {
                console.error(
                  `No callback function found in t.test() in ${entry}`
                );
                process.exit(1);
              }
              // Ensure the callback has a parameter named 't'
              if (testCb.params.length === 0) {
                testCb.params.push({ type: "Identifier", name: "t" });
              }
              break;
            case "beforeEach":
            case "before":
            case "after":
            case "afterEach":
              node.callee = {
                type: "Identifier",
                name: node.callee.property.name,
              };
              break;
            case "setTimeout":
              node.callee = { type: "Identifier", name: "setTimeout" };
              node.arguments[1] = node.arguments[0];
              node.arguments[0] = {
                type: "ArrowFunctionExpression",
                params: [],
                body: {
                  type: "BlockStatement",
                  body: [],
                },
                expression: false,
              };
              break;
            case "comment":
              node.callee = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "console" },
                property: { type: "Identifier", name: "log" },
              };
              break;
            case "throws":
            case "match":
            case "notMatch":
            case "pass":
            case "rejects":
            case "same":
              node.callee = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "_testHelpers" },
                property: {
                  type: "Identifier",
                  name: node.callee.property.name,
                },
              };
              break;
            case "end":
            case "equal":
            case "ok":
            case "notOk":
            case "fail":
            case "error":
              node.callee.object = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "t" },
                property: { type: "Identifier", name: "assert" },
              };
              switch (node.callee.property.name) {
                case "equal":
                  node.callee.property.name = "strictEqual";
                  break;
                case "throws":
                  node.callee.property.name = "throws";
                  break;
                case "notOk":
                  node.callee.property.name = "ok";
                  node.arguments[0] = {
                    type: "UnaryExpression",
                    operator: "!",
                    prefix: true,
                    argument: node.arguments[0],
                  };
                  break;
                case "end":
                  node.callee.property.name = "ok";
                  node.arguments = [
                    {
                      type: "Literal",
                      value: true,
                      raw: "true",
                    },
                  ];
                  break;
                case "error":
                  node.callee.property.name = "ifError";
                  break;
                default:
                  break;
              }
            default:
              break;
          }
        }

        // Replace require(...) with await import(...)
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          this.replace({
            type: "AwaitExpression",
            argument: {
              type: "ImportExpression",
              options: null,
              phase: null,
              source: node.arguments[0],
            },
          });
        }
      }

      // Replace __dirname with import.meta.dirname
      if (node.type === "Identifier" && node.name === "__dirname") {
        this.replace({
          type: "MemberExpression",
          object: {
            type: "MemberExpression",
            object: { type: "Identifier", name: "import" },
            property: { type: "Identifier", name: "meta" },
          },
          property: { type: "Identifier", name: "dirname" },
        });
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

const timeout = 1000 * 60 * 5; // 5 minutes

let command = `node --test --test-concurrency 4 --test-timeout ${timeout} --test-force-exit`;

// Coverage
command +=
  " --experimental-test-coverage --test-reporter spec --test-reporter lcov";
command +=
  "  --test-reporter-destination=stdout --test-reporter-destination=lcov.info";
command += " --test-coverage-include='../library/**'"; // Exclude test files from coverage

// Pass args to test command, e.g. use node --run test:esm -- ./path/to/test.js
command += ` ${process.argv.slice(2).join(" ")}`;

await execAsyncWithPipe(command, {
  env: {
    CI: true,
    AIKIDO_TEST_NEW_INSTRUMENTATION: "true",
    AIKIDO_UNIT_TESTS: "1",
    AIKIDO_CI: "true",
    NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    AIKIDO_ESM_TEST: true,
    ...process.env,
  },
  cwd: testsOutDir,
});
