import * as t from "tap";
import { filterEmptyRequestHeaders } from "./filterEmptyRequestHeaders";

t.test("it filters empty headers", async (t) => {
  t.same(
    filterEmptyRequestHeaders({
      string: "value",
      array: ["a", "b"],
      emptyArray: [],
      undefined: undefined,
    }),
    {
      string: "value",
      array: ["a", "b"],
    }
  );
});
