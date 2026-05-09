import * as t from "tap";
import { wrapNewInstance } from "./wrapNewInstance";

t.test("Agent is not initialized", async (t) => {
  try {
    wrapNewInstance({}, "test", { name: "test", type: "external" }, () => {});
    t.fail();
  } catch (e: unknown) {
    t.ok(e instanceof Error);
    if (e instanceof Error) {
      t.same(
        e.message,
        "Can not wrap new instance if agent is not initialized"
      );
    }
  }
});
