import * as t from "tap";
import { normalizeRequestHeaders } from "./normalizeRequestHeaders";

t.test("it normalizes headers", async (t) => {
  t.same(
    normalizeRequestHeaders({
      string: "value",
      array: ["a", "b"],
      undefined: undefined,
    }),
    {
      string: "value",
      array: ["a", "b"],
    }
  );
});
