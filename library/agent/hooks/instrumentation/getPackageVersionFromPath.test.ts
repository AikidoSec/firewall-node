import * as t from "tap";
import { getPackageVersionFromPath } from "./getPackageVersionFromPath";
import { join } from "path";

t.test("it works", async (t) => {
  t.equal(getPackageVersionFromPath(join(__dirname, "../../..")), "0.0.0");
  t.equal(
    getPackageVersionFromPath(join(__dirname, "../../../node_modules/accepts")),
    "2.0.0"
  );
  t.equal(getPackageVersionFromPath("test123"), undefined);
});
