import * as t from "tap";
import { createRestifyTests } from "./Restify.tests";

t.test("Restify", async () => {
  await createRestifyTests("restify-v12");
});
