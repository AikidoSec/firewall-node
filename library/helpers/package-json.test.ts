import { readFileSync } from "fs";
import * as t from "tap";

// @esm-tests-skip - Different directory structure (not inside lib dir)

t.test("Check that no other dependencies are present", async (t) => {
  const PackageJson = JSON.parse(readFileSync("../package.json", "utf8"));

  t.equal(PackageJson.dependencies, undefined);
});
