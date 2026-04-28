import * as t from "tap";

// @esm-tests-skip - Different directory structure (not inside lib dir)

const PackageJson = require("../package.json");

t.test("Check that no other dependencies are present", async (t) => {
  t.equal(PackageJson.dependencies, undefined);
});
