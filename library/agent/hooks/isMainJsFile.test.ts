import * as t from "tap";
import { isMainJsFile } from "./isMainJsFile";
import type { PackageJson } from "type-fest";
import { sep } from "path";

const basePackageJson: PackageJson = {
  name: "aikido-module",
  version: "1.0.0",
  main: "./index.js",
};

const base =
  process.platform === "win32"
    ? "C:\\Users\\abc\\proj\\node_modules\\aikido-module"
    : "/home/user/proj/node_modules/aikido-module";

t.test("package.json main: is main file", async (t) => {
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "./index.js",
      },
      "abc",
      `${base}${sep}index.js`,
      basePackageJson
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.js",
      },
      "abc",
      `${base}${sep}index.js`,
      basePackageJson
    )
  );

  // Is true because require id and package name are the same
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "test.js",
      },
      "aikido-module",
      `${base}${sep}test.js`,
      basePackageJson
    )
  );

  // Fallback if main field is not set
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.js",
      },
      "abc",
      `${base}${sep}index.js`,
      // @ts-expect-error main can not be undefined in types
      {
        ...basePackageJson,
        ...{ main: undefined },
      }
    )
  );
});

t.test("package.json main: is not main file", async (t) => {
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "test.js",
      },
      "abc",
      `${base}${sep}test.js`,
      basePackageJson
    )
  );

  // Path and filename do not match
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.js",
      },
      "abc",
      `${base}${sep}test.js`,
      // @ts-expect-error main can not be undefined in types
      {
        ...basePackageJson,
        ...{ main: undefined },
      }
    )
  );
});

t.test("package.json exports: is main file", async (t) => {
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: "index.cjs" },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: "./index.cjs" },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "./test/index.cjs",
      },
      "abc",
      `${base}${sep}test${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: "test/index.cjs" },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "./test/index.cjs",
      },
      "abc",
      `${base}${sep}test${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: ["test/index.cjs"] },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.mjs",
          exports: {
            ".": "./index.cjs",
            "./test": "./test/abc.cjs",
          },
        },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.mjs",
          exports: {
            ".": {
              require: "./index.cjs",
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.mjs",
          exports: {
            ".": {
              node: "./index.cjs",
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      }
    )
  );
});

t.test("package.json exports: is not main file", async (t) => {
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs" },
      }
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "./test/index2.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test/index2.cjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: "test/index.cjs" },
      }
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "./test/index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test/index.cjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: [] },
      }
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "./test/index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test/index.cjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "index.mjs", exports: null },
      }
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.mjs",
          exports: {
            "./abc": "./index.cjs",
            "./test": "./test/abc.cjs",
          },
        },
      }
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: base,
        path: "index.cjs",
      },
      "abc",
      `${base}${sep}index.cjs`,
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.mjs",
          exports: {
            ".": {
              browser: "./index.cjs",
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      }
    )
  );
});
