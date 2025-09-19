import * as t from "tap";
import { wrap } from "./wrap";
import { ip } from "./ipAddress";

const os = require("os");

// @esm-tests-skip - wrap of exports not possible

wrap(os, "networkInterfaces", function wrap() {
  return function wrap() {
    return {
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      bond0: [{ address: "10.206.52.79", family: "IPv4", internal: false }],
    };
  };
});

t.test("it works", async () => {
  t.same(ip(), "10.206.52.79");
});

t.test("platform is win32", async () => {
  wrap(os, "platform", function wrap() {
    return function wrap() {
      return "win32";
    };
  });

  t.same(ip(), "10.206.52.79");
});
