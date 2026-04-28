const assert = require("node:assert");

const Zen = require("@aikidosec/firewall");
const context = require("@aikidosec/firewall/context");
const lambda = require("@aikidosec/firewall/lambda");
const cloudFunction = require("@aikidosec/firewall/cloud-function");
const bundler = require("@aikidosec/firewall/bundler");

assert.ok(typeof Zen.addExpressMiddleware === "function");
assert.ok(typeof Zen.setUser === "function");
assert.ok(typeof context.setUser === "function");
assert.ok(typeof lambda === "function");
assert.ok(typeof cloudFunction === "function");
assert.ok(Array.isArray(bundler.externals()));
