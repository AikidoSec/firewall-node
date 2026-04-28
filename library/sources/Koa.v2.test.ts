import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { isNewInstrumentationUnitTest } from "../helpers/isNewInstrumentationUnitTest";
import { createKoaTests } from "./Koa.tests";
import * as t from "tap";

t.test(
  "Koa",
  {
    skip:
      getMajorNodeVersion() < 25 && isNewInstrumentationUnitTest()
        ? "require(esm) triggers ERR_INVALID_RETURN_PROPERTY_VALUE"
        : undefined,
  },
  async () => {
    createKoaTests("koa-v2");
  }
);
