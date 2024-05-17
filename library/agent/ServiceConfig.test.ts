import * as t from "tap";
import { ServiceConfig } from "./ServiceConfig";

t.test("it returns false if empty rules", async () => {
  const config = new ServiceConfig([], 0, []);
  t.same(config.shouldProtectEndpoint("GET", "/foo"), true);
  t.same(config.getLastUpdatedAt(), 0);
  t.same(config.isUserBlocked("id"), false);
});

t.test("it works", async () => {
  const config = new ServiceConfig(
    [
      { method: "GET", route: "/foo", forceProtectionOff: false },
      { method: "POST", route: "/foo", forceProtectionOff: true },
      { method: "POST", route: /fly+/.source, forceProtectionOff: true },
    ],
    0,
    ["123"]
  );

  t.same(config.shouldProtectEndpoint("GET", "/foo"), true);
  t.same(config.shouldProtectEndpoint("POST", "/foo"), false);
  t.same(config.shouldProtectEndpoint("GET", "/unknown"), true);
  t.same(config.shouldProtectEndpoint("POST", /fly+/), false);
  t.same(config.isUserBlocked("123"), true);
  t.same(config.isUserBlocked("567"), false);
});
