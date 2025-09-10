import * as t from "tap";
import { wrap } from "../../../helpers/wrap";
import { registerNodeHooks } from ".";

const logs: string[] = [];
wrap(console, "warn", function warn() {
  return function warn(...args: string[]) {
    logs.push(...args);
  };
});

t.test("it works", async (t) => {
  // This function already calls checkHooks, so we don't need to call it again
  registerNodeHooks();

  // Required because the check itself is async
  await new Promise((resolve) => setTimeout(resolve, 100));

  t.same(logs, []);
});
