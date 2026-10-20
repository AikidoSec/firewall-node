import * as t from "tap";
import { getModuleInfoFromPath } from "./getModuleInfoFromPath";

t.test("it works", async (t) => {
  t.same(
    getModuleInfoFromPath(
      "/Users/aikido/Projects/sec/node_modules/mysql/lib/Connection.js"
    ),
    {
      name: "mysql",
      base: "/Users/aikido/Projects/sec/node_modules/mysql",
      path: "lib/Connection.js",
    }
  );
});

t.test("it works with scoped package", async (t) => {
  t.same(
    getModuleInfoFromPath(
      "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework/build/src/logger.js"
    ),
    {
      name: "@google-cloud/functions-framework",
      base: "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework",
      path: "build/src/logger.js",
    }
  );
});

t.test("returns undefined for invalid path", async (t) => {
  const info = getModuleInfoFromPath("/Users/aikido/Projects/sec");
  t.equal(info, undefined);
});

t.test("works with file:// protocol", async (t) => {
  t.same(
    getModuleInfoFromPath(
      "file:///Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework/build/src/logger.js"
    ),
    {
      name: "@google-cloud/functions-framework",
      base: "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework",
      path: "build/src/logger.js",
    }
  );
});
