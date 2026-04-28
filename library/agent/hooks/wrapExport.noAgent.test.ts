import * as t from "tap";
import { wrapExport } from "./wrapExport";

t.test("Agent is not initialized", async (t) => {
  try {
    wrapExport(
      {},
      "test",
      { name: "test", type: "external" },
      {
        kind: "outgoing_http_op",
        inspectArgs: () => {},
      }
    );
    t.fail();
  } catch (e: unknown) {
    t.ok(e instanceof Error);
    if (e instanceof Error) {
      t.same(e.message, "Can not wrap exports if agent is not initialized");
    }
  }
});
