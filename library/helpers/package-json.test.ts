import t from "tap";

const PackageJson = require("../package.json");

t.test("Check that only correct dependencies are used", async (t) => {
  t.same(PackageJson.dependencies, {
    "import-in-the-middle": "^1.11.1",
  });
});
