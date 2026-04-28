import * as t from "tap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createRestifyTests } from "./Restify.tests";

t.test(
  "Restify",
  {
    skip:
      getMajorNodeVersion() > 16
        ? "Restify v9 only supports node v16"
        : undefined,
  },
  async () => {
    createRestifyTests("restify-v9");
  }
);
