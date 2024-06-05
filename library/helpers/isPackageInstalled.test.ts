import * as t from "tap";
import { isPackageInstalled } from "./isPackageInstalled";

t.test("it returns true if the package is installed", async (t) => {
  const result = isPackageInstalled("tap");
  t.equal(result, true);
});

t.test("it returns false if the package is not installed", async (t) => {
  const result = isPackageInstalled("nonexistent-package");
  t.equal(result, false);
});
