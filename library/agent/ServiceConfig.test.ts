import * as t from "tap";
import { ServiceConfig } from "./ServiceConfig";

t.test("it returns false if empty rules", async () => {
  const config = new ServiceConfig([]);
  t.same(config.shouldProtectEndpoint("GET", "/foo"), true);
});

t.test("it works", async () => {
  const config = new ServiceConfig([
    { method: "GET", route: "/foo", forceProtectionOff: false },
    { method: "POST", route: "/foo", forceProtectionOff: true },
    { method: "POST", route: /fly+/.source, forceProtectionOff: true },
  ]);

  t.same(config.shouldProtectEndpoint("GET", "/foo"), true);
  t.same(config.shouldProtectEndpoint("POST", "/foo"), false);
  t.same(config.shouldProtectEndpoint("GET", "/unknown"), true);
  t.same(config.shouldProtectEndpoint("POST", /fly+/), false);
});
