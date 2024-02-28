import * as t from "tap";
import { normalizeHeaders } from "./normalizeHeaders";

t.test("it normalizes headers", async (t) => {
  t.same(
    normalizeHeaders({
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
