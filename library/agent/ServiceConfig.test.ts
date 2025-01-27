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
    {
      source: "geoip",
      description: "description",
      ips: [
        "1.2.3.4",
        "192.168.2.1/24",
        "fd00:1234:5678:9abc::1",
        "fd00:3234:5678:9abc::1/64",
        "5.6.7.8/32",
      ],
    },
  ]);
  t.same(config.isIPAddressBlocked("1.2.3.4"), {
    blocked: true,
    reason: "description",
  });
  t.same(config.isIPAddressBlocked("2.3.4.5"), { blocked: false });
  t.same(config.isIPAddressBlocked("192.168.2.2"), {
    blocked: true,
    reason: "description",
  });
  t.same(config.isIPAddressBlocked("fd00:1234:5678:9abc::1"), {
    blocked: true,
    reason: "description",
  });
  t.same(config.isIPAddressBlocked("fd00:1234:5678:9abc::2"), {
    blocked: false,
  });
  t.same(config.isIPAddressBlocked("fd00:3234:5678:9abc::1"), {
    blocked: true,
    reason: "description",
  });
  t.same(config.isIPAddressBlocked("fd00:3234:5678:9abc::2"), {
    blocked: true,
    reason: "description",
  });
  t.same(config.isIPAddressBlocked("5.6.7.8"), {
    blocked: true,
    reason: "description",
  });
  t.same(config.isIPAddressBlocked("1.2"), { blocked: false });
});

t.test("it blocks bots", async () => {
  const config = new ServiceConfig([], 0, [], [], true, []);
  config.updateBlockedUserAgents("googlebot|bingbot");

  t.same(config.isUserAgentBlocked("googlebot"), { blocked: true });
  t.same(config.isUserAgentBlocked("123 bingbot abc"), { blocked: true });
  t.same(config.isUserAgentBlocked("bing"), { blocked: false });

  config.updateBlockedUserAgents("");

  t.same(config.isUserAgentBlocked("googlebot"), { blocked: false });
});
