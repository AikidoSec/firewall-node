import * as t from "tap";
import { getModuleInfoFromPath } from "./getModuleInfoFromPath";
import { toWinPathIfWin as toWin } from "../../helpers/toWinPathIfWin";

t.test("it works", async (t) => {
  t.same(
    getModuleInfoFromPath(
      toWin("/Users/aikido/Projects/sec/node_modules/mysql/lib/Connection.js")
    ),
    {
      name: "mysql",
      base: toWin("/Users/aikido/Projects/sec/node_modules/mysql"),
      path: toWin("lib/Connection.js"),
    }
  );
});

t.test("it works with scoped package", async (t) => {
  t.same(
    getModuleInfoFromPath(
      toWin(
        "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework/build/src/logger.js"
      )
    ),
    {
      name: "@google-cloud/functions-framework",
      base: toWin(
        "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework"
      ),
      path: toWin("build/src/logger.js"),
    }
  );
});

t.test("returns undefined for invalid path", async (t) => {
  const info = getModuleInfoFromPath("/Users/aikido/Projects/sec");
  t.equal(info, undefined);
});
