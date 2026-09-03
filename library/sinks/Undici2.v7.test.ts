import { createUndiciTests } from "./Undici2.tests";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

const libName = getMajorNodeVersion() >= 20 ? "undici-v7" : "undici-v7-old";

createUndiciTests(libName, 5007);
