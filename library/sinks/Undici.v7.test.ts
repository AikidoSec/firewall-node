import { createUndiciTests } from "./Undici.tests";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

const libName = getMajorNodeVersion() >= 20 ? "undici-v7" : "undici-v7-old";

createUndiciTests(libName, 4007);
