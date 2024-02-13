import * as t from "tap";
import { IDGeneratorULID } from "./IDGenerator";

t.test("it returns ULID", async () => {
  t.match(new IDGeneratorULID().generate(), /[0-9A-Z]{26}/);
});
