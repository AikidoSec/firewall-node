import * as t from "tap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createRestifyTests } from "./Restify.tests";

t.test(
  "Koa",
  {
    skip:
      getMajorNodeVersion() > 16 ? "Restify v8 only supports node v16" : undefined,
  },
  async (t) => {
    createRestifyTests("restify");
  }
);
