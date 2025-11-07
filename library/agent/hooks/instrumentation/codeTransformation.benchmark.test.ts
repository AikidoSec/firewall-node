/* eslint-disable no-console */
import * as t from "tap";
import { transformCode } from "./codeTransformation";
import { readFile } from "fs/promises";
import { join } from "path";

t.before(() => {
  // Skip replacing the import path for unit tests from @aikidosec/firewall/instrument/internals to the local path
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "false";
});

t.after(() => {
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";
});

t.test("Benchmark: Small code transformation", async (t) => {
  const iterations = 1000;

  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    transformCode(
      "testpkg",
      "1.0.0",
      "test.js",
      `
        import { test } from "test";
        class Test {

            private testValue = 42;

            constructor() {
                this.testFunction(testValue);
            }
            testFunction(arg1) {
                console.log("test");
            }
        }
        `,
      "module",
      {
        path: "test.js",
        versionRange: "^1.0.0",
        identifier: "testpkg.test.js.^1.0.0",
        functions: [
          {
            nodeType: "MethodDefinition",
            name: "testFunction",
            identifier: "testpkg.test.js.testFunction.MethodDefinition.v1.0.0",
            inspectArgs: true,
            modifyArgs: false,
            modifyReturnValue: false,
            modifyArgumentsObject: false,
          },
        ],
        accessLocalVariables: [],
      }
    );
  }

  const end = performance.now();
  const duration = end - start;
  const durationPerIteration = duration / iterations;

  console.log(
    `Code transformation took ${durationPerIteration}ms per iteration`
  );

  t.ok(
    durationPerIteration < 1.0,
    `Code transformation took less than 1ms per iteration, actual: ${durationPerIteration}ms`
  );
});

t.test("Benchmark: Large code transformation", async (t) => {
  const iterations = 1000;

  const start = performance.now();

  const honoSrc = await readFile(
    join(__dirname, "../../../node_modules/hono/dist/hono-base.js"),
    "utf8"
  );

  for (let i = 0; i < iterations; i++) {
    transformCode("hono", "4.0.0", "dist/hono-base.js", honoSrc, "module", {
      path: "dist/hono-base.js",
      identifier: "hono.dist.hono-base.js.v4.0.0",
      versionRange: "^4.0.0",
      functions: [
        {
          nodeType: "MethodDefinition",
          name: "addRoute",
          identifier: "hono.dist.hono-base.js.addRoute.MethodDefinition.v4.0.0",
          inspectArgs: true,
          modifyArgs: false,
          modifyReturnValue: false,
          modifyArgumentsObject: false,
        },
      ],
      accessLocalVariables: [],
    });
  }

  const end = performance.now();
  const duration = end - start;
  const durationPerIteration = duration / iterations;

  console.log(
    `Code transformation took ${durationPerIteration}ms per iteration`
  );

  t.ok(
    durationPerIteration < 2.0,
    `Code transformation took less than 2ms per iteration, actual: ${durationPerIteration}ms`
  );
});
