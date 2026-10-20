import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { createMariadbTests } from "./MariaDB.tests";

// Mariadb v3.5 is ESM-only, so it can only be used with the new instrumentation system
// We could run this test in CJS with the new instrumentation system, but tapjs does not like this
// So for now, we only run this test in ESM, where it can be run with the new instrumentation system without any issues
if (isEsmUnitTest()) {
  createMariadbTests("mariadb-v3.5");
}
