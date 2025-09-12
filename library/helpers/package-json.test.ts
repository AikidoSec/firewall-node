import { readFileSync } from "fs";
import * as t from "tap";

const PackageJson = JSON.parse(readFileSync("../package.json", "utf8"));

t.test("Check that no other dependencies are present", async (t) => {
  t.equal(PackageJson.dependencies, undefined);
});
