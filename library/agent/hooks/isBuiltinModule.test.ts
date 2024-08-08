import * as t from "tap";
import { isBuiltinModule } from "./isBuiltinModule";
import {
  getMajorNodeVersion,
  getMinorNodeVersion,
} from "../../helpers/getNodeVersion";

// Added in Node.js v18.6.0, v16.17.0
function isSupported() {
  const major = getMajorNodeVersion();
  if (major > 18) {
    return true;
  }
  const minor = getMinorNodeVersion();
  if (major === 18 && minor >= 6) {
    return true;
  }
  if (major === 16 && minor >= 17) {
    return true;
  }
  return false;
}

function expect(res: boolean) {
  if (isSupported()) {
    return res;
  }
  return undefined;
}

t.test("it works", async (t) => {
  t.equal(isBuiltinModule("fs"), expect(true));
  t.equal(isBuiltinModule("mysql"), expect(false));
  t.equal(isBuiltinModule("http"), expect(true));
  t.equal(isBuiltinModule("node:http"), expect(true));
  t.equal(isBuiltinModule("test"), expect(false));
  // @ts-expect-error Testing the undefined case
  t.equal(isBuiltinModule(undefined), expect(false));
});
