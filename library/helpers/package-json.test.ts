import * as t from "tap";

const PackageJson = require("../package.json");

t.test("Check that no other dependencies are present", async (t) => {
  t.equal(PackageJson.dependencies, undefined);
});
