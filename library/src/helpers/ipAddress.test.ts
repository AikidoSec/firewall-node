import * as t from "tap";
import { wrap } from "shimmer";

wrap(require("os"), "networkInterfaces", function () {
  return function () {
    return {
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
      bond0: [{ address: "10.206.52.79", family: "IPv4", internal: false }],
    };
  };
});

import { ip } from "./ipAddress";

t.test("it works", async () => {
  t.same(ip(), "10.206.52.79");
});
