import * as t from "tap";
import { transformCodeInsertSCA } from "./transformCodeInsertSCA";

t.before(() => {
  // Skip replacing the import path for unit tests from @aikidosec/firewall/instrument/internals to the local path
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "false";
});

t.after(() => {
  process.env.AIKIDO_TEST_NEW_INSTRUMENTATION = "true";
});

const isSameCode = (t: any, code1: string, code2: string) => {
  const removeWhitespace = (str: string) => str.replace(/\s+/g, "");

  t.same(removeWhitespace(code1), removeWhitespace(code2));
};

t.test("it inserts __instrumentPackageWrapped correctly (CJS)", async (t) => {
  isSameCode(
    t,
    transformCodeInsertSCA(
      "testpkg",
      "1.0.0",
      "index.js",
      `
      function test() {
        return true;
      }
    `,
      "commonjs"
    ),
    `
    const { __instrumentPackageLoaded } = require("@aikidosec/firewall/instrument/internals");
    function test() {
      return true;
    }
    __instrumentPackageLoaded("testpkg", "1.0.0");
  `
  );
});

t.test("it inserts __instrumentPackageWrapped correctly (ESM)", async (t) => {
  isSameCode(
    t,
    transformCodeInsertSCA(
      "testpkg",
      "1.0.0",
      "index.js",
      `
      function test() {
        return true;
      }
    `,
      "module"
    ),
    `
    import { __instrumentPackageLoaded } from "@aikidosec/firewall/instrument/internals";
    function test() {
      return true;
    }
    __instrumentPackageLoaded("testpkg", "1.0.0");
  `
  );
});

t.test("invalid code throws error", async (t) => {
  try {
    transformCodeInsertSCA(
      "testpkg",
      "1.0.0",
      "index.js",
      `
      function test( {
        return true;
      }
    `,
      "module"
    );
    t.fail("Expected error to be thrown");
  } catch (err: any) {
    t.match(err.message, /Error transforming code:/);
  }
});

t.test("correct format detection", async (t) => {
  isSameCode(
    t,
    transformCodeInsertSCA(
      "testpkg",
      "1.0.0",
      "index.mjs",
      `
      function test() {
        return true;
      }
    `,
      "unambiguous"
    ),
    `
    import { __instrumentPackageLoaded } from "@aikidosec/firewall/instrument/internals";
    function test() {
      return true;
    }
    __instrumentPackageLoaded("testpkg", "1.0.0");
  `
  );
});
