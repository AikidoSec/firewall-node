import t from "tap";
import {
  getMajorNodeVersion,
  getMinorNodeVersion,
  getSemverNodeVersion,
} from "./getNodeVersion";

t.test("getMajorNodeVersion", async (t) => {
  t.ok(typeof getMajorNodeVersion() === "number");
});

t.test("getMinorNodeVersion", async (t) => {
  t.ok(typeof getMinorNodeVersion() === "number");
});

t.test("getSemverNodeVersion", async (t) => {
  const parts = getSemverNodeVersion().split(".");
  t.ok(parts.length === 3);
  t.notOk(parts.includes("v"));
  parts.forEach((part) => {
    t.ok(parseInt(part, 10) >= 0);
  });
});
