import * as t from "tap";
import { getMajorNodeVersion, getMinorNodeVersion } from "./getNodeVersion";

t.test("getMajorNodeVersion", async (t) => {
  t.ok(typeof getMajorNodeVersion() === "number");
});

t.test("getMinorNodeVersion", async (t) => {
  t.ok(typeof getMinorNodeVersion() === "number");
});
