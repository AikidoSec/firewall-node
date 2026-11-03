import * as t from "tap";
import {
  getMajorNodeVersion,
  getSemverNodeVersion,
} from "../helpers/getNodeVersion";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { createPostgresjsTests } from "./Postgresjs.tests";

const nodeVersion = getSemverNodeVersion();
const canRequireEsm =
  isVersionGreaterOrEqual("20.19.0", nodeVersion) ||
  isVersionGreaterOrEqual("22.12.0", nodeVersion);

if (isEsmUnitTest() ? getMajorNodeVersion() >= 20 : canRequireEsm) {
  createPostgresjsTests("postgres-v4");
} else {
  t.skip(
    "Postgres.js v4 tests require Node.js 20+ (ESM) or 20.19+ / 22.12+ (require(esm))",
    () => {}
  );
}
