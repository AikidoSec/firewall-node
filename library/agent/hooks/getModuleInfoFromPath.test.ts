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

t.test(
  "falls back to stripping file:// if the URL can't be converted",
  { skip: process.platform === "win32" ? "POSIX paths only" : false },
  async (t) => {
    // Encoded slashes (%2F) make fileURLToPath throw
    t.same(
      getModuleInfoFromPath(
        "file:///Users/aikido/a%2Fb/node_modules/mysql/lib/Connection.js"
      ),
      {
        name: "mysql",
        base: "/Users/aikido/a%2Fb/node_modules/mysql",
        path: "lib/Connection.js",
      }
    );
  }
);

t.test("decodes percent-encoded file:// URLs", async (t) => {
  t.same(
    getModuleInfoFromPath(
      "file:///Users/aikido/My%20Projects/node_modules/mysql/lib/Connection.js"
    ),
    {
      name: "mysql",
      base: "/Users/aikido/My Projects/node_modules/mysql",
      path: "lib/Connection.js",
    }
  );
});
