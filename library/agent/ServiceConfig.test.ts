import * as t from "tap";
import { ServiceConfig } from "./ServiceConfig";

t.test("it returns false if empty rules", async () => {
  const config = new ServiceConfig([], 0, [], [], false, [], []);
  t.same(config.getLastUpdatedAt(), 0);
  t.same(config.isUserBlocked("id"), false);
  t.same(config.isBypassedIP("1.2.3.4"), false);
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
    [],
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
        allowedIPAddresses: undefined,
        rateLimiting: {
          enabled: false,
          maxRequests: 0,
          windowSizeInMS: 0,
        },
      },
    ]
  );
});

t.test("it checks if IP is bypassed", async () => {
  const config = new ServiceConfig([], 0, [], ["1.2.3.4"], false, [], []);
  t.same(config.isBypassedIP("1.2.3.4"), true);
  t.same(config.isBypassedIP("1.2.3.5"), false);
});

t.test("ip blocking works", async () => {
  const config = new ServiceConfig(
    [],
    0,
    [],
    [],
    false,
    [
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
    ],
    []
  );
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
  const config = new ServiceConfig([], 0, [], [], true, [], []);
  config.updateBlockedUserAgents("googlebot|bingbot");

  t.same(config.isUserAgentBlocked("googlebot"), { blocked: true });
  t.same(config.isUserAgentBlocked("123 bingbot abc"), { blocked: true });
  t.same(config.isUserAgentBlocked("bing"), { blocked: false });

  config.updateBlockedUserAgents("");

  t.same(config.isUserAgentBlocked("googlebot"), { blocked: false });
});

t.test("restricting access to some ips", async () => {
  const config = new ServiceConfig(
    [],
    0,
    [],
    [],
    true,
    [],
    [
      {
        source: "geoip",
        description: "description",
        ips: ["1.2.3.4"],
      },
    ]
  );

  t.same(config.isAllowedIPAddress("1.2.3.4").allowed, true);
  t.same(config.isAllowedIPAddress("4.3.2.1").allowed, false);
  t.same(config.isAllowedIPAddress("127.0.0.1").allowed, true); // Always allow private ips

  config.updateAllowedIPAddresses([]);
  t.same(config.isAllowedIPAddress("1.2.3.4").allowed, true);
  t.same(config.isAllowedIPAddress("127.0.0.1").allowed, true);
  t.same(config.isAllowedIPAddress("4.3.2.1").allowed, true);
});

t.test("only allow some ips: empty list", async () => {
  const config = new ServiceConfig(
    [],
    0,
    [],
    [],
    true,
    [],
    [
      {
        source: "geoip",
        description: "description",
        ips: [],
      },
    ]
  );

  t.same(config.isAllowedIPAddress("1.2.3.4").allowed, true);
  t.same(config.isAllowedIPAddress("4.3.2.1").allowed, true);
});

t.test("bypassed ips support cidr", async () => {
  const config = new ServiceConfig(
    [],
    0,
    [],
    ["192.168.2.0/24", "::1"],
    false,
    [],
    []
  );

  t.same(config.isBypassedIP("192.168.2.32"), true);
  t.same(config.isBypassedIP("::1"), true);
  t.same(config.isBypassedIP("::2"), false);
  t.same(config.isBypassedIP("10.0.0.1"), false);

  config.updateConfig(
    [],
    0,
    [],
    ["invalid", "2002::1/124", "127.0.0.1"],
    false
  );

  t.same(config.isBypassedIP("2002::6"), true);
  t.same(config.isBypassedIP("2002::f"), true);
  t.same(config.isBypassedIP("2002::10"), false);
  t.same(config.isBypassedIP("127.0.0.1"), true);
  t.same(config.isBypassedIP("192.168.2.1"), false);
  t.same(config.isBypassedIP("::1"), false);

  config.updateConfig(
    [],
    0,
    [],
    ["0", "123.123.123.1/32", "234.0.0.0/8", "999.999.999.999", "::1/128"],
    false
  );

  t.same(config.isBypassedIP("123.123.123.1"), true);
  t.same(config.isBypassedIP("124.123.123.1"), false);
  t.same(config.isBypassedIP("234.1.2.3"), true);
  t.same(config.isBypassedIP("235.1.2.3"), false);
  t.same(config.isBypassedIP("127.0.0.1"), false);
  t.same(config.isBypassedIP("999.999.999.999"), false);
  t.same(config.isBypassedIP("::1"), true);
  t.same(config.isBypassedIP("::2"), false);

  config.updateConfig([], 0, [], [], false);

  t.same(config.isBypassedIP("123.123.123.1"), false);
  t.same(config.isBypassedIP("999.999.999.999"), false);
});
