import * as t from "tap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createKoaTests } from "./Koa.tests";

t.test(
  "Koa",
  { skip: getMajorNodeVersion() < 18 ? "Koa v3 requires Node 18" : undefined },
  async (t) => {
    createKoaTests("koa-v3");
  }
);
