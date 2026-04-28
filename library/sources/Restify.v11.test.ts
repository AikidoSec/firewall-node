import * as t from "tap";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { createRestifyTests } from "./Restify.tests";

t.test(
  "Restify",
  {
    skip:
      getMajorNodeVersion() > 18
        ? "Restify v11 only supports node v18 and lower"
        : undefined,
  },
  async () => {
    createRestifyTests("restify-v11");
  }
);
