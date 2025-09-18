import { readFileSync } from "fs";
import * as t from "tap";

t.test(
  "Check that no other dependencies are present",
  {
    skip: process.env.IS_ESM_TEST
      ? "ESM tests are executed in a different context"
      : false,
  },
  async (t) => {
    const PackageJson = JSON.parse(readFileSync("../package.json", "utf8"));

    t.equal(PackageJson.dependencies, undefined);
  }
);
