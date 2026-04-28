import * as t from "tap";
import { getPackageVersionFromPath } from "./getPackageVersionFromPath";
import { join } from "path";

// @esm-tests-skip

t.test("it works", async (t) => {
  // Running twice to hit the cache
  t.equal(getPackageVersionFromPath(join(__dirname, "../../..")), "0.0.0");
  t.equal(getPackageVersionFromPath(join(__dirname, "../../..")), "0.0.0");
  t.equal(
    getPackageVersionFromPath(join(__dirname, "../../../node_modules/accepts")),
    "2.0.0"
  );
  t.equal(
    getPackageVersionFromPath(join(__dirname, "../../../node_modules/accepts")),
    "2.0.0"
  );
  t.equal(getPackageVersionFromPath("test123"), undefined);
  t.equal(getPackageVersionFromPath("test123"), undefined);
});
