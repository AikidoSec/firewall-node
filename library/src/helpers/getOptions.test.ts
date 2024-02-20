import * as t from "tap";
import { getOptions } from "./getOptions";

t.test("getOptions(), should return default options", async () => {
  // Create testing environment
  process.env.AIKIDO_NO_BLOCKING = "false";

  t.same(getOptions(), {
    debug: false,
    block: true,
  });
});

t.test("getOptions(), should check for dryMode", async () => {
  // Create testing environment
  process.env.AIKIDO_NO_BLOCKING = "true";

  t.same(getOptions(), {
    debug: false,
    block: false,
  });
});

t.test("getOptions(), should allow you to set other options", async () => {
  // Create testing environment
  process.env.AIKIDO_NO_BLOCKING = "false";

  t.notOk(getOptions({ debug: false }).debug);
  t.ok(getOptions({ debug: true }).debug);
});
