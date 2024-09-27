import * as t from "tap";

const PackageJson = require("../package.json");

t.test("Check that no other dependencies are present", async (t) => {
  t.same(Object.keys(PackageJson.dependencies), ["@aikidosec/zen-internals"]);
});
