import * as t from "tap";
import { resolve } from "node:path";
import { zenEsbuildPlugin } from "../../index";
import { isNewInstrumentationUnitTest } from "../../../helpers/isNewInstrumentationUnitTest";
import { getMajorNodeVersion } from "../../../helpers/getNodeVersion";

// @esm-tests-skip

const cjsTestPath = resolve(__dirname, "fixtures", "hono-cjs-sqlite.cjs");
const esmTestPath = resolve(__dirname, "fixtures", "hono-esm-pg.mjs");

const options = {
  skip: getMajorNodeVersion() < 18 ? "Tests require Node.js 18+" : false,
};

let restoreTestNewInstrumentationEnv = false;
t.before(() => {
  if (isNewInstrumentationUnitTest()) {
    // Skip replacing the import path for unit tests from @aikidosec/firewall/instrument/internals to the local path
    process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "false";
    restoreTestNewInstrumentationEnv = true;
  }
});

t.after(() => {
  if (restoreTestNewInstrumentationEnv) {
    process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";
  }
});

t.test("it works in memory (ESM)", options, async (t) => {
  const { build } = await import("esbuild");
  const result = await build({
    entryPoints: [esmTestPath],
    bundle: true,
    platform: "node",
    format: "esm",
    plugins: [
      zenEsbuildPlugin({
        copyFiles: false,
      }),
    ],
    write: false,
  });

  t.equal(result.outputFiles?.length, 1);
  const code = result.outputFiles?.[0].text || "";

  t.match(code, /__instrumentInspectArgs.*"pg\.lib/);
  t.match(code, /__instrumentModifyArgs.*"hono.dist/);
  t.match(code, /@aikidosec\/firewall\/instrument\/internals/);
  t.match(code, /__instrumentPackageLoaded/);
  t.notMatch(code, /function __instrumentInspectArgs/);
});

t.test("it works in memory (CJS)", options, async (t) => {
  const { build } = await import("esbuild");

  const result = await build({
    entryPoints: [cjsTestPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    plugins: [
      zenEsbuildPlugin({
        copyFiles: false,
      }),
    ],
    write: false,
  });

  t.equal(result.outputFiles?.length, 1);
  const code = result.outputFiles?.[0].text || "";

  t.match(code, /__instrumentModifyArgs.*"hono.dist/);
  t.match(code, /@aikidosec\/firewall\/instrument\/internals/);
  t.match(code, /__instrumentPackageLoaded/);
  t.match(code, /__instrumentAccessLocalVariables\("sqlite3.lib/);
  t.notMatch(code, /function __instrumentInspectArgs/);
});

t.test("it throws error when outdir is missing", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [cjsTestPath],
      bundle: true,
      platform: "node",
      format: "cjs",
      plugins: [zenEsbuildPlugin()],
      write: false,
    })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: esbuild outdir is not set. Please set the outdir option in your esbuild config./
    );
  }
});

t.test("it throws error when external is invalid", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [esmTestPath],
      bundle: true,
      platform: "node",
      format: "esm",
      plugins: [zenEsbuildPlugin()],
      // @ts-expect-error testing invalid external option
      external: "test123",
      write: false,
    })
  );
  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: esbuild external option needs to be an array or undefined./
    );
  }
});

t.test("it throws error when output format is invalid", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [esmTestPath],
      bundle: true,
      platform: "node",
      format: "iife",
      plugins: [zenEsbuildPlugin()],
      write: false,
    })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: esbuild output format is set to unsupported value 'iife'. Please set it to 'cjs' or 'esm'./
    );
  }
});

t.test("it throws error when output format is missing", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [esmTestPath],
      bundle: true,
      platform: "node",
      plugins: [zenEsbuildPlugin()],
      write: false,
    })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(error.message, /Aikido: esbuild output format is undefined./);
  }
});

t.test("it throws error when bundle is false", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [esmTestPath],
      bundle: false,
      platform: "node",
      plugins: [zenEsbuildPlugin()],
      write: false,
      format: "esm",
    })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: esbuild bundling is not enabled. You do not need to use the Aikido esbuild plugin/
    );
  }
});

t.test("it throws error if packages are externalized", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [esmTestPath],
      bundle: true,
      platform: "node",
      plugins: [zenEsbuildPlugin()],
      write: false,
      format: "esm",
      packages: "external",
    })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: esbuild 'packages' option is set to 'external'./
    );
  }
});

t.test("it works when external is an array", options, async (t) => {
  const { build } = await import("esbuild");

  const result = await build({
    entryPoints: [cjsTestPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    plugins: [
      zenEsbuildPlugin({
        copyFiles: false,
      }),
    ],
    external: ["some-external-package"],
    write: false,
  });

  t.equal(result.outputFiles?.length, 1);
  const code = result.outputFiles?.[0].text || "";

  t.match(code, /__instrumentModifyArgs.*"hono.dist/);
  t.match(code, /@aikidosec\/firewall\/instrument\/internals/);
  t.match(code, /__instrumentPackageLoaded/);
  t.match(code, /__instrumentAccessLocalVariables\("sqlite3.lib/);
  t.notMatch(code, /function __instrumentInspectArgs/);
});

t.test("it throws if inject is invalid", options, async (t) => {
  const { build } = await import("esbuild");

  const error = await t.rejects(() =>
    build({
      entryPoints: [esmTestPath],
      bundle: true,
      platform: "node",
      plugins: [zenEsbuildPlugin()],
      write: false,
      format: "esm",
      // @ts-expect-error testing invalid inject option
      inject: { invalid: true },
    })
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(error.message, /Aikido: esbuild inject option is not an array/);
  }
});
