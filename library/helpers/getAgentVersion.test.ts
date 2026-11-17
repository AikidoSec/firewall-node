import * as t from "tap";
import { getAgentVersion } from "./getAgentVersion";
import { isEsmUnitTest } from "./isEsmUnitTest";
import { wrap } from "./wrap";

t.test("it returns the current library version", async () => {
  t.equal(getAgentVersion(), "0.0.0");
});

t.test(
  "it does not use the instrumented path.resolve",
  { skip: isEsmUnitTest() ? "requires CommonJS" : false },
  async (t) => {
    const path = require("path") as typeof import("path");
    const modulePath = require.resolve("./getAgentVersion");
    const originalResolve = path.resolve;
    let calls = 0;

    wrap(path, "resolve", (original) => {
      return function wrapped(this: unknown, ...args: unknown[]) {
        if (args.includes("../package.json")) {
          calls++;
        }
        return original.apply(this, args);
      };
    });

    try {
      delete require.cache[modulePath];
      const fresh =
        require("./getAgentVersion") as typeof import("./getAgentVersion");

      t.equal(fresh.getAgentVersion(), "0.0.0");
      t.equal(calls, 0);
    } finally {
      path.resolve = originalResolve;
      delete require.cache[modulePath];
    }
  }
);
