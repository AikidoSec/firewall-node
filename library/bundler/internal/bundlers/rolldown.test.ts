import * as t from "tap";
import { resolve } from "path";
import { zenRolldownPlugin } from "../../index";
import { readFile } from "fs/promises";
import { getMajorNodeVersion } from "../../../helpers/getNodeVersion";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";

// @esm-tests-skip

const options = {
  skip:
    getMajorNodeVersion() < 20
      ? "Rolldown ESM builds require Node.js 20+"
      : false,
};

const cjsTestPath = resolve(__dirname, "fixtures", "hono-cjs-sqlite.cjs");
const esmTestPath = resolve(__dirname, "fixtures", "hono-esm-pg.mjs");

t.test("it works in memory (ESM)", options, async (t) => {
  const { rolldown } = await import("rolldown");

  const bundle = await rolldown({
    platform: "node",
    input: esmTestPath,
    plugins: [
      zenRolldownPlugin({
        copyFiles: false,
      }),
    ],
  });

  const { output } = await bundle.generate({ format: "esm" });

  t.same(output.length > 0, true);
  const code = output[0].code;

  t.match(code, /__instrumentInspectArgs.*"pg\.lib/);
  t.match(code, /__instrumentModifyArgs.*"hono.dist/);
  if (!isNewInstrumentationUnitTest()) {
    t.match(code, /@aikidosec\/firewall\/instrument\/internals/);
  }
  t.match(code, /__instrumentPackageLoaded/);
  t.notMatch(code, /function __instrumentInspectArgs/);
});

t.test("it works when writing to temp file (ESM)", options, async (t) => {
  const tempDir = t.testdir();
  const { rolldown } = await import("rolldown");

  const bundle = await rolldown({
    platform: "node",
    input: esmTestPath,
    plugins: [
      zenRolldownPlugin({
        copyFiles: false,
      }),
    ],
  });

  await bundle.write({ format: "esm", dir: tempDir });

  // Read the generated file
  // noopengrep
  const bundledFile = await readFile(
    //noopengrep
    resolve(tempDir, "hono-esm-pg.js"),
    "utf-8"
  );

  t.same(bundledFile.length > 0, true);

  t.match(bundledFile, /__instrumentInspectArgs\("pg\.lib/);
  t.match(bundledFile, /__instrumentModifyArgs.*"hono.dist/);
  if (!isNewInstrumentationUnitTest()) {
    t.match(bundledFile, /@aikidosec\/firewall\/instrument\/internals/);
  }
  t.notMatch(bundledFile, /function __instrumentInspectArgs/);
});

t.test("it throws error when output dir is not set", options, async (t) => {
  const { rolldown } = await import("rolldown");

  const bundle = await rolldown({
    platform: "node",
    input: esmTestPath,
    plugins: [zenRolldownPlugin()],
  });

  const error = await t.rejects(() => bundle.write({ format: "esm" }));

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: rolldown output directory is not specified. Please set the 'output.dir' option in your rolldown config./
    );
  }
});

t.test("external option is not an array", options, async (t) => {
  const { rolldown } = await import("rolldown");

  const error = await t.rejects(() =>
    rolldown({
      platform: "node",
      input: esmTestPath,
      plugins: [zenRolldownPlugin()],
      external: "test123",
    })
  );
  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: rolldown external option needs to be an array or undefined./
    );
  }
});

t.test("invalid output format", options, async (t) => {
  const { rolldown } = await import("rolldown");

  const bundle = await rolldown({
    platform: "node",
    input: esmTestPath,
    plugins: [zenRolldownPlugin()],
  });

  const error = await t.rejects(() => bundle.write({ format: "iife" }));

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: rolldown output format is set to unsupported value 'iife'. Please set it to 'cjs' or 'esm'./
    );
  }
});

t.test("it works in memory (CJS)", options, async (t) => {
  const { rolldown } = await import("rolldown");

  const bundle = await rolldown({
    platform: "node",
    input: cjsTestPath,
    plugins: [
      zenRolldownPlugin({
        copyFiles: false,
      }),
    ],
  });

  const { output } = await bundle.generate({ format: "cjs" });

  t.same(output.length > 0, true);
  const code = output[0].code;

  t.match(code, /__instrumentPackageLoaded/);
  t.match(code, /__instrumentModifyArgs.*"hono.dist/);
  if (!isNewInstrumentationUnitTest()) {
    t.match(code, /@aikidosec\/firewall\/instrument\/internals/);
  }
  t.match(code, /__instrumentAccessLocalVariables\("sqlite3.lib/);
  t.notMatch(code, /function __instrumentInspectArgs/);
});
