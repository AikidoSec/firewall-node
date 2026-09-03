import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createUndiciTests } from "./Undici.tests";

if (getMajorNodeVersion() >= 22) {
  createUndiciTests("undici-v8", 4008);
}
