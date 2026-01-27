import * as t from "tap";
import { checkHooks } from "./checkHooks";
import { wrap } from "../../../helpers/wrap";

const logs: string[] = [];
wrap(console, "warn", function warn() {
  return function warn(...args: string[]) {
    logs.push(...args);
  };
});

t.test("it works", async (t) => {
  await checkHooks();

  t.same(logs, [
    "AIKIDO: A self check of the code instrumentation failed. This means that the protection might not work as expected.",
  ]);
});
