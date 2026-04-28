import * as t from "tap";
import * as pkg from "../index";

t.test("has named and default exports", async (t) => {
  t.same(typeof pkg, "object");
  t.same(typeof pkg.default, "object");

  t.same(
    Object.keys(pkg).length - 1,
    Object.keys(pkg.default).length,
    "same number of named exports and default exports"
  );

  for (const key of Object.keys(pkg)) {
    if (key === "default") continue;
    t.same(
      pkg[key as keyof typeof pkg],
      pkg.default[key as keyof typeof pkg.default],
      `export ${key} is the same`
    );
  }
});
