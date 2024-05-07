import * as t from "tap";
import { Config } from "./Config";

t.test("it returns false if empty rules", async () => {
  const config = new Config([], [], 0);
  t.same(config.shouldProtectEndpoint("GET", "/foo"), true);
  t.same(config.shouldBlockUser("userId"), false);
  t.same(config.getLastUpdatedAt(), 0);
});

t.test("it works", async () => {
  const config = new Config(
    [
      { method: "GET", route: "/foo", forceProtectionOff: false },
      { method: "POST", route: "/foo", forceProtectionOff: true },
      { method: "POST", route: /fly+/.source, forceProtectionOff: true },
    ],
    ["userId"],
    0
  );

  t.same(config.shouldProtectEndpoint("GET", "/foo"), true);
  t.same(config.shouldProtectEndpoint("POST", "/foo"), false);
  t.same(config.shouldProtectEndpoint("GET", "/unknown"), true);
  t.same(config.shouldProtectEndpoint("POST", /fly+/), false);
  t.same(config.shouldBlockUser("userId"), true);
  t.same(config.shouldBlockUser("unknown"), false);
});
