import * as t from "tap";
import { getPackageVersion } from "./getPackageVersion";

t.test("it resolves the version of a package", async (t) => {
  t.same(getPackageVersion("express"), "5.0.1");
  t.same(getPackageVersion("non-existing-package"), null);
  t.same(getPackageVersion("@google-cloud/functions-framework"), "3.4.3");
});
