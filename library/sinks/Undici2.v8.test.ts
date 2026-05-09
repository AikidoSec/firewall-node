import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createUndiciTests } from "./Undici2.tests";

if (getMajorNodeVersion() >= 22) {
  createUndiciTests("undici-v8", 5008);
}
