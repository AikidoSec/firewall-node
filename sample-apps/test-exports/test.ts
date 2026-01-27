import assert from "node:assert";

import Zen from "@aikidosec/firewall";
import context from "@aikidosec/firewall/context";
import lambda from "@aikidosec/firewall/lambda";
import cloudFunction from "@aikidosec/firewall/cloud-function";
import { externals } from "@aikidosec/firewall/bundler";
import "@aikidosec/firewall/nopp";

assert.ok(typeof Zen.addExpressMiddleware === "function");
assert.ok(typeof Zen.setUser === "function");
assert.ok(typeof context.setUser === "function");
assert.ok(typeof lambda === "function");
assert.ok(typeof cloudFunction === "function");
assert.ok(Array.isArray(externals()));
