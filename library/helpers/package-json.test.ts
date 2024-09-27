import * as t from "tap";

const PackageJson = require("../package.json");

t.test("Check that only correct dependencies are used", (t) => {
  t.equal(PackageJson.dependencies, {
    "import-in-the-middle": "^1.11.1",
  });
});
