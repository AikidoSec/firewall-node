import * as t from "tap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createRestifyTests } from "./Restify.tests";

t.test(
  "Restify",
  {
    skip:
      getMajorNodeVersion() < 22
        ? "Restify v12 only supports node v22 and higher"
        : undefined,
  },
  async () => {
    await createRestifyTests("restify-v12");
  }
);
