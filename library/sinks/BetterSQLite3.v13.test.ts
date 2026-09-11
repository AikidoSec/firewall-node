import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createBetterSQLite3Tests } from "./BetterSQLite3.tests";
import * as t from "tap";

if (getMajorNodeVersion() >= 22) {
  createBetterSQLite3Tests("better-sqlite3-v13");
} else {
  t.skip("BetterSQLite3 v13 tests require Node.js 22 or higher", () => {});
}
