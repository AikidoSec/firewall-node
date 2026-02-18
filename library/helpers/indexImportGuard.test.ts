import * as t from "tap";
import { wrap } from "./wrap";

// @esm-tests-skip

const logs: string[] = [];
wrap(console, "error", function warn() {
  return function error(message: string) {
    logs.push(message);
  };
});
wrap(console, "log", function warn() {
  return function log(message: string) {
    logs.push(message);
  };
});

t.test("it works", async (t) => {
  process.env.AIKIDO_DEBUG = "true";
  process.env.AIKIDO_BLOCK = "false";

  t.same(logs, []);
  require("../index");
  t.match(logs, [
    "AIKIDO: Starting agent v0.0.0...",
    "AIKIDO: Dry mode enabled, no requests will be blocked!",
    "AIKIDO: No token provided, disabling reporting.",
  ]);

  // Clear logs
  logs.length = 0;

  // Clear require cache
  for (const path in require.cache) {
    delete require.cache[path];
  }

  require("../index");

  t.match(logs, [
    "AIKIDO: Zen has already been initialized. This can lead to unexpected behavior and may be caused by cleaning the require cache or using multiple installations of Zen at the same time.",
  ]);
});
