import {
  mkdir,
  glob,
  writeFile,
  rm,
  readFile,
  copyFile,
  cp,
  symlink,
} from "fs/promises";
import { dirname, join, resolve } from "path";
import { exec } from "child_process";
import { existsSync } from "fs";
import { parseSync } from "oxc-parser";
import { generate } from "astring";
import { transform } from "oxc-transform";
import { walk } from "oxc-walker";

const args = process.argv.slice(2);
const cjs = args.includes("--cjs");
if (cjs === args.includes("--esm")) {
  throw new Error("Specify exactly one mode: --cjs or --esm.");
}
const newInstrumentation = !cjs || args.includes("--new");
const testPatterns = args.filter(
  (arg) => !["--cjs", "--esm", "--new", "--coverage"].includes(arg)
);
const [major, minor] = process.versions.node.split(".").map(Number);

const minimumMajor = cjs ? 22 : 24;
const requiresNewerMinor = cjs && major === minimumMajor && minor < 17;

if (major < minimumMajor || requiresNewerMinor) {
  throw new Error(
    `Node.js ${cjs ? "22.17" : "24"} or higher is required to run this script.`
  );
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
const outDir = join(import.meta.dirname, "../.builtin-tests");
const libBuildDir = join(import.meta.dirname, "../build");
const testsOutDir = join(outDir, "tests");
const libOutDir = cjs ? testsOutDir : join(outDir, "library");

if (existsSync(outDir)) {
  await rm(outDir, { recursive: true, force: true });
}

await cp(libBuildDir, libOutDir, {
  recursive: true,
  filter: (path) =>
    path !== join(libBuildDir, "node_modules") && !path.endsWith(".d.ts"),
});

if (!cjs) {
  await execAsyncWithPipe(
    `./node_modules/.bin/tsc -p tsconfig.test.esm.json --outDir ${libOutDir}`,
    {
      cwd: libDir,
    }
  );
} else {
  await copyFile(
    join(libDir, "package.json"),
    join(testsOutDir, "package.json")
  );
}

await writeFile(join(outDir, "package.json"), "{}");

const testFiles = glob(
  "**/*.{ts,txt,pem,json,xml,js,mjs,prisma,toml,sql,zip}",
  {
    cwd: libDir,
    exclude: ["**/node_modules/**", "**/.tap/**", "**/*.d.ts"],
  }
);

// Copy all test files and transform them
for await (const entry of testFiles) {
  const src = join(libDir, entry);
  const dest = join(testsOutDir, entry.replace(/ts$/, "js"));

  await mkdir(dirname(dest), { recursive: true });
  if (entry.endsWith(".ts") && !/\.(test|tests)\.ts$/.test(entry)) {
    if (cjs) {
      // Some tests read the TypeScript sources (e.g. agent/protect.test.ts)
      await copyFile(src, join(testsOutDir, entry));
    }
    continue;
  }

  if (
    [
      "txt",
      "pem",
      "json",
      "xml",
      "js",
      "mjs",
      "prisma",
      "toml",
      "sql",
      "zip",
    ].includes(entry.split(".").pop())
  ) {
    await copyFile(src, dest);
    continue;
  }

  const sourceText = await readFile(src, "utf8");

  if (!cjs && sourceText.includes("// @esm-tests-skip")) {
    continue;
  }

  const filename = entry.split("/").pop();
  const newFilename = filename.replace(/ts$/, "js");

  // --------------- Transform TS to JS and parse to AST ----------------
  let { code, errors } = await transform(filename, sourceText, {
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
  if (!cjs) {
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
  }

  code =
    `import * as _testHelpers from ${JSON.stringify(join(import.meta.dirname, "helpers", "test-helpers.mjs"))};\n` +
    code;

  const ast = parseSync(newFilename, code, {
    preserveParens: false,
  });

  const exports = [];

  // --------------- Traverse the AST ---------------

  // https://www.npmjs.com/package/oxc-walker
  walk(ast.program, {
    enter(node) {
      if (node.type === "ImportDeclaration") {
        const source = node.source;

        if (source.value === "tap") {
          node.specifiers = [
            "test",
            "beforeEach",
            "before",
            "after",
            "afterEach",
          ].map((name) => ({
            type: "ImportSpecifier",
            imported: { type: "Identifier", name },
            local: { type: "Identifier", name },
          }));
          source.value = "node:test";
          source.raw = JSON.stringify(source.value);
        }

        if (cjs) {
          const required = `require(${JSON.stringify(source.value)})`;
          const declarations = node.specifiers.map((specifier) => {
            switch (specifier.type) {
              case "ImportNamespaceSpecifier":
                return `const ${specifier.local.name} = ${required};`;
              case "ImportDefaultSpecifier":
                return `const ${specifier.local.name} = ${required}.default;`;
              case "ImportSpecifier":
                return `const ${specifier.local.name} = ${required}[${JSON.stringify(specifier.imported.name)}];`;
            }
          });
          const statements = parseSync(
            newFilename,
            declarations.join("\n") || `${required};`
          ).program.body;
          if (statements[0].type === "VariableDeclaration") {
            statements[0].declarations = statements.flatMap(
              (statement) => statement.declarations
            );
          }
          this.replace(statements[0]);
          return;
        }

        // Only modify relative imports (those starting with ".")
        if (typeof source.value === "string" && source.value.startsWith(".")) {
          const isTestFile = source.value.endsWith(".tests");
          const newPath = resolve(dirname(dest), source.value).replace(
            ".builtin-tests/tests/",
            isTestFile ? ".builtin-tests/tests/" : ".builtin-tests/library/"
          );

          // Update import source
          source.value = `${newPath}.js`;
          source.raw = `'${newPath}.js'`;
        }
      }
      if (cjs && node.type === "ExportNamedDeclaration") {
        if (!node.declaration)
          throw new Error(`Unsupported CJS export in ${entry}`);
        const declaration = node.declaration;
        const names =
          declaration.type === "VariableDeclaration"
            ? declaration.declarations.map((item) => item.id.name)
            : [declaration.id.name];
        this.replace(declaration);
        for (const name of names) {
          exports.push(
            ...parseSync(newFilename, `exports.${name} = ${name};`).program.body
          );
        }
        return;
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
              node.callee = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "_testHelpers" },
                property: { type: "Identifier", name: "test" },
              };
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
              break;
            case "teardown":
              node.callee = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "_testHelpers" },
                property: { type: "Identifier", name: "teardown" },
              };
              break;
            case "beforeEach":
            case "before":
            case "after":
            case "afterEach":
              node.callee = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "_testHelpers" },
                property: {
                  type: "Identifier",
                  name: node.callee.property.name,
                },
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
            case "skip":
            case "end":
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
            case "equal":
            case "not":
            case "ok":
            case "notOk":
            case "fail":
            case "error":
            case "doesNotThrow":
              node.callee.object = {
                type: "MemberExpression",
                object: { type: "Identifier", name: "_testHelpers" },
                property: { type: "Identifier", name: "assert" },
              };
              switch (node.callee.property.name) {
                case "equal":
                  node.callee.property.name = "strictEqual";
                  break;
                case "not":
                  node.callee.property.name = "notStrictEqual";
                  break;
                case "throws":
                  node.callee.property.name = "throws";
                  break;
                case "doesNotThrow":
                  node.callee.property.name = "doesNotThrow";
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
          !cjs &&
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

      // Compile dynamic imports to require, like TypeScript does for CommonJS output
      if (cjs && node.type === "ImportExpression") {
        const source = generate(node.source);
        this.replace(
          parseSync(
            newFilename,
            `Promise.resolve().then(() => require(${source}));`
          ).program.body[0].expression
        );
        return;
      }

      // Replace __dirname with import.meta.dirname
      if (!cjs && node.type === "Identifier" && node.name === "__dirname") {
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

  ast.program.body.push(...exports);
  let output = generate(ast.program);
  if (cjs) {
    const result = await transform(
      dest.replace(/js$/, "ts"),
      '"use strict";\n' + output,
      { sourcemap: true }
    );
    output =
      result.code +
      `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(result.map)).toString("base64")}\n`;
  }
  await writeFile(dest, output);
}

if (cjs) {
  // The instrumentation loads injectedFunctions.ts, but it has to be plain JS here
  const injectedFunctions = "agent/hooks/instrumentation/injectedFunctions";
  await copyFile(
    join(testsOutDir, `${injectedFunctions}.js`),
    join(testsOutDir, `${injectedFunctions}.ts`)
  );
}

// Create package.json with type module to run tap as ESM
if (!cjs) {
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
}

await symlink(join(libDir, "node_modules"), join(testsOutDir, "node_modules"));
if (!cjs) {
  await symlink(join(libDir, "node_modules"), join(libOutDir, "node_modules"));
}

const timeout = 1000 * 60 * 5; // 5 minutes

let command = `node --test --expose-gc --test-concurrency 4 --test-timeout ${timeout} --test-force-exit`;
if (cjs) command += " --enable-source-maps";

// Coverage
command +=
  " --experimental-test-coverage --test-reporter spec --test-reporter lcov";
command +=
  "  --test-reporter-destination=stdout --test-reporter-destination=lcov.info";
command += ` --test-coverage-include='${libOutDir}/**/*.js'`;
if (cjs) {
  command +=
    " --test-coverage-exclude='**/*.test.js' --test-coverage-exclude='**/*.tests.js'";
}

// Pass args to test command, e.g. use node --run test:esm -- ./path/to/test.js
command += ` ${testPatterns.map((pattern) => `'${pattern.replace(/\.ts$/, ".js")}'`).join(" ")}`;

await execAsyncWithPipe(command, {
  env: {
    CI: true,
    AIKIDO_UNIT_TESTS: "1",
    AIKIDO_CI: "true",
    NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
    ...process.env,
    AIKIDO_ESM_TEST: cjs ? "false" : "true",
    AIKIDO_TEST_NEW_INSTRUMENTATION: newInstrumentation ? "true" : "false",
  },
  cwd: testsOutDir,
});
