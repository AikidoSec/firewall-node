import * as t from "tap";
import { onBuildEnd, resetBuildState, transform } from "./base";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

// @esm-tests-skip

t.test("calling onBuildEnd throws if not options are set", async (t) => {
  const error = await t.rejects(() => onBuildEnd(undefined, {}));

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: Output format is undefined at build end. This is likely a bug in the bundler plugin./
    );
  }
});

t.test("calling onBuildEnd without output dir throws error", async (t) => {
  const error = await t.rejects(() =>
    onBuildEnd(
      {
        outputFormat: "esm",
      },
      {}
    )
  );

  t.ok(error instanceof Error);
  if (error instanceof Error) {
    t.match(
      error.message,
      /Aikido: Output directory is undefined at build end. This is likely a bug in the bundler plugin./
    );
  }
});

t.test(
  "calling onBuildEnd without output dir does not throw if copyFiles is false",
  async (t) => {
    onBuildEnd(
      {
        outputFormat: "esm",
      },
      {
        copyFiles: false,
      }
    );
    t.end();
  }
);

t.test(
  "@aikidosec/firewall/instrument is forbidden in esm builds in user code",
  async (t) => {
    resetBuildState();
    transform(
      `import { something } from '@aikidosec/firewall/instrument';`,
      "test-file.ts"
    );

    const error = await t.rejects(() =>
      onBuildEnd(
        {
          outputFormat: "esm",
          outDir: "dist",
        },
        {}
      )
    );

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        /Aikido: Detected import of '@aikidosec\/firewall\/instrument' in your code while building an ESM bundle./
      );
    }
  }
);

t.test(
  "@aikidosec/firewall/instrument is missing in cjs builds in user code",
  async (t) => {
    resetBuildState();
    transform(`require('some-other-package');`, "test-file.js");

    const error = await t.rejects(() =>
      onBuildEnd(
        {
          outputFormat: "cjs",
          outDir: "dist",
        },
        {}
      )
    );

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(
        error.message,
        /Aikido: Missing import of '@aikidosec\/firewall\/instrument' in your code while building a CJS bundle./
      );
    }
  }
);

t.test("File copy process is working", async (t) => {
  resetBuildState();
  transform(`require("@aikidosec/firewall/instrument");`, "test-file.js");

  const outputDir = await mkdtemp(
    join(tmpdir(), "zen-unit-test-bundling-copy-")
  );
  try {
    await onBuildEnd(
      {
        outputFormat: "cjs",
        outDir: outputDir,
      },
      {}
    );

    const packagePath = join(
      outputDir,
      "node_modules",
      "@aikidosec",
      "firewall"
    );
    t.same(existsSync(join(packagePath, "package.json")), true);
    t.same(existsSync(join(packagePath, "node_internals")), true);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

t.test(
  "calling onBuildEnd can't find lib if unit test env is false",
  async (t) => {
    process.env.AIKIDO_UNIT_TESTS = "0";
    const error = await t.rejects(() =>
      onBuildEnd(
        {
          outputFormat: "esm",
          outDir: t.testdir(),
        },
        {}
      )
    );

    t.ok(error instanceof Error);
    if (error instanceof Error) {
      t.match(error.message, /Cannot find module/);
    }

    process.env.AIKIDO_UNIT_TESTS = "1";
  }
);
