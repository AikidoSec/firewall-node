import * as t from "tap";
import { ServiceConfig } from "./ServiceConfig";

t.test("it returns false if empty rules", async () => {
  const config = new ServiceConfig([], 0, [], [], false, []);
  t.same(config.getLastUpdatedAt(), 0);
  t.same(config.isUserBlocked("id"), false);
  t.same(config.isAllowedIP("1.2.3.4"), false);
  t.same(
    config.getEndpoints({
      url: undefined,
      method: undefined,
      route: undefined,
    }),
    []
  );
});

t.test("it works", async () => {
  const config = new ServiceConfig(
    [
      {
        method: "GET",
        route: "/foo",
        forceProtectionOff: false,
        rateLimiting: {
          enabled: false,
          maxRequests: 0,
          windowSizeInMS: 0,
        },
      },
      {
        method: "POST",
        route: "/foo",
        forceProtectionOff: true,
        rateLimiting: {
          enabled: false,
          maxRequests: 0,
          windowSizeInMS: 0,
        },
      },
      {
        method: "POST",
        route: /fly+/.source,
        forceProtectionOff: true,
        rateLimiting: {
          enabled: false,
          maxRequests: 0,
          windowSizeInMS: 0,
        },
      },
    ],
    0,
    ["123"],
    [],
    false,
    []
  );

  t.same(config.isUserBlocked("123"), true);
  t.same(config.isUserBlocked("567"), false);
  t.same(
    config.getEndpoints({
      url: undefined,
      method: "GET",
      route: "/foo",
    }),
    [
      {
        method: "GET",
        route: "/foo",
        forceProtectionOff: false,
        rateLimiting: {
          enabled: false,
          maxRequests: 0,
          windowSizeInMS: 0,
        },
      },
    ]
  );
});

t.test("it checks if IP is allowed", async () => {
  const config = new ServiceConfig([], 0, [], ["1.2.3.4"], false, []);
  t.same(config.isAllowedIP("1.2.3.4"), true);
  t.same(config.isAllowedIP("1.2.3.5"), false);
});

t.test("ip blocking works", async () => {
  const config = new ServiceConfig([], 0, [], [], false, [
    "1.2.3.4",
    "192.168.2.1/24",
    "fd00:1234:5678:9abc::1",
    "fd00:3234:5678:9abc::1/64",
    "5.6.7.8/32",
  ]);
  t.same(config.isIPAddressBlocked("1.2.3.4"), true);
  t.same(config.isIPAddressBlocked("2.3.4.5"), false);
  t.same(config.isIPAddressBlocked("192.168.2.2"), true);
  t.same(config.isIPAddressBlocked("fd00:1234:5678:9abc::1"), true);
  t.same(config.isIPAddressBlocked("fd00:1234:5678:9abc::2"), false);
  t.same(config.isIPAddressBlocked("fd00:3234:5678:9abc::1"), true);
  t.same(config.isIPAddressBlocked("fd00:3234:5678:9abc::2"), true);
  t.same(config.isIPAddressBlocked("5.6.7.8"), true);
});
