import * as t from "tap";
import { getModuleInfoFromPath } from "./getModuleInfoFromPath";

t.test("it works", async (t) => {
  const info = getModuleInfoFromPath(
    "/Users/aikido/Projects/sec/node_modules/mysql/lib/Connection.js"
  );
  t.equal(info?.name, "mysql");
  t.equal(info?.base, "/Users/aikido/Projects/sec/node_modules/mysql");
  t.equal(info?.path, "lib/Connection.js");
});

t.test("it works with scoped package", async (t) => {
  const info = getModuleInfoFromPath(
    "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework/build/src/logger.js"
  );
  t.equal(info?.name, "@google-cloud/functions-framework");
  t.equal(
    info?.base,
    "/Users/aikido/Projects/sec/node_modules/@google-cloud/functions-framework"
  );
  t.equal(info?.path, "build/src/logger.js");
});

t.test("returns undefined for invalid path", async (t) => {
  const info = getModuleInfoFromPath("/Users/aikido/Projects/sec");
  t.equal(info, undefined);
});
