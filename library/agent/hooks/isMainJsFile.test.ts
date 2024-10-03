import t from "tap";
import { isMainJsFile } from "./isMainJsFile";
import type { PackageJson } from "type-fest";

const basePackageJson: PackageJson = {
  name: "aikido-module",
  version: "1.0.0",
  main: "./index.js",
};

t.test("package.json main: is main file", async (t) => {
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "./index.js",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.js",
      basePackageJson
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.js",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.js",
      basePackageJson
    )
  );

  // Is true because require id and package name are the same
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "test.js",
      },
      "aikido-module",
      "/home/user/proj/node_modules/aikido-module/test.js",
      basePackageJson
    )
  );

  // Fallback if main field is not set
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.js",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.js",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "test.js",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test.js",
      basePackageJson
    )
  );

  // Path and filename do not match
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.js",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test.js",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.js",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.js",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{ main: "./index" },
      }
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "./test/index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "./test/index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/test/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
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
        base: "/home/user/proj/node_modules/aikido-module",
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
        base: "/home/user/proj/node_modules/aikido-module",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.cjs",
      },
      "abc",
      "/home/user/proj/node_modules/aikido-module/index.cjs",
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

t.test("Works with esm import", async (t) => {
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.mjs",
          exports: {
            ".": {
              browser: "./index.cjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      },
      true
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.js",
          exports: {
            "./": {
              browser: "./index.cjs",
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      },
      true
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.js",
          exports: {
            "./index.mjs": {
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      },
      true
    )
  );
  t.ok(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        main: undefined,
      },
      true
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.js",
          exports: {
            ".": {
              browser: "./index.cjs",
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      },
      false
    )
  );
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.js",
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
  t.notOk(
    isMainJsFile(
      {
        name: "aikido-module",
        base: "/home/user/proj/node_modules/aikido-module",
        path: "index.mjs",
      },
      undefined,
      "/home/user/proj/node_modules/aikido-module/index.mjs",
      // @ts-expect-error Merge
      {
        ...basePackageJson,
        ...{
          main: "index.js",
          exports: {
            "./tester": {
              browser: "./index.cjs",
              import: "./index.mjs",
            },
            "./test": "./test/abc.cjs",
          },
        },
      },
      true
    )
  );
});
