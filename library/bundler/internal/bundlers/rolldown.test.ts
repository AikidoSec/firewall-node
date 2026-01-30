import * as t from "tap";
import { rolldown } from "rolldown";
import { resolve } from "path";
import { zenRolldownPlugin } from "../..";
import { readFile } from "fs/promises";

t.test("it works in memory (ESM)", async (t) => {
  const bundle = await rolldown({
    platform: "node",
    input: resolve(__dirname, "../../../../sample-apps/hono-pg-esm", "app.js"),
    plugins: [
      zenRolldownPlugin({
        copyFiles: false,
      }),
    ],
  });

  const { output } = await bundle.generate({ format: "esm" });

  t.same(output.length > 0, true);
  const code = output[0].code;

  t.match(code, /__instrumentInspectArgs\("pg\.lib/);
  t.match(code, /__instrumentModifyArgs\("hono.dist/);
  t.match(code, /@aikidosec\/firewall\/instrument\/internals/);
  t.notMatch(code, /function __instrumentInspectArgs/);
});

t.test("it works when writing to temp file (ESM)", async (t) => {
  const tempDir = t.testdir();

  const bundle = await rolldown({
    platform: "node",
    input: resolve(__dirname, "../../../../sample-apps/hono-pg-esm", "app.js"),
    plugins: [
      zenRolldownPlugin({
        copyFiles: false,
      }),
    ],
  });

  await bundle.write({ format: "esm", dir: tempDir });

  // Read the generated file
  const bundledFile = await readFile(resolve(tempDir, "app.js"), "utf-8");

  t.same(bundledFile.length > 0, true);

  t.match(bundledFile, /__instrumentInspectArgs\("pg\.lib/);
  t.match(bundledFile, /__instrumentModifyArgs\("hono.dist/);
  t.match(bundledFile, /@aikidosec\/firewall\/instrument\/internals/);
  t.notMatch(bundledFile, /function __instrumentInspectArgs/);
});

t.test("it throws error when output dir is not set", async (t) => {
  const bundle = await rolldown({
    platform: "node",
    input: resolve(__dirname, "../../../../sample-apps/hono-pg-esm", "app.js"),
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

t.test("external option is not an array", async (t) => {
  const error = await t.rejects(() =>
    rolldown({
      platform: "node",
      input: resolve(
        __dirname,
        "../../../../sample-apps/hono-pg-esm",
        "app.js"
      ),
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

t.test("invalid output format", async (t) => {
  const bundle = await rolldown({
    platform: "node",
    input: resolve(__dirname, "../../../../sample-apps/hono-pg-esm", "app.js"),
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
