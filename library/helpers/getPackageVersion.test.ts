import * as t from "tap";
import { getPackageVersion } from "./getPackageVersion";

t.test("it resolves the version of a package", async (t) => {
  t.same(getPackageVersion("express"), "5.1.0");
  t.same(getPackageVersion("non-existing-package"), null);
  t.same(getPackageVersion("@google-cloud/functions-framework"), "4.0.0");
});
