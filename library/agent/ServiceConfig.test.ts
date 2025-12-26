import * as t from "tap";
import { ServiceConfig } from "./ServiceConfig";

t.test("it returns false if empty rules", async () => {
  const config = new ServiceConfig([], 0, [], [], [], []);
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
  const config = new ServiceConfig([], 0, [], ["1.2.3.4"], [], []);
  t.same(config.isBypassedIP("1.2.3.4"), true);
  t.same(config.isBypassedIP("1.2.3.5"), false);
});

t.test("ip blocking works", async () => {
  const config = new ServiceConfig(
    [],
    0,
    [],
    [],
    [
      {
        key: "geoip/Belgium;BE",
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
  const config = new ServiceConfig([], 0, [], [], [], []);
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
    [],
    [
      {
        key: "geoip/Belgium;BE",
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
    [],
    [
      {
        key: "geoip/Belgium;BE",
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
    [],
    []
  );

  t.same(config.isBypassedIP("192.168.2.32"), true);
  t.same(config.isBypassedIP("::1"), true);
  t.same(config.isBypassedIP("::2"), false);
  t.same(config.isBypassedIP("10.0.0.1"), false);

  config.updateConfig([], 0, [], ["invalid", "2002::1/124", "127.0.0.1"]);

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
    ["0", "123.123.123.1/32", "234.0.0.0/8", "999.999.999.999", "::1/128"]
  );

  t.same(config.isBypassedIP("123.123.123.1"), true);
  t.same(config.isBypassedIP("124.123.123.1"), false);
  t.same(config.isBypassedIP("234.1.2.3"), true);
  t.same(config.isBypassedIP("235.1.2.3"), false);
  t.same(config.isBypassedIP("127.0.0.1"), false);
  t.same(config.isBypassedIP("999.999.999.999"), false);
  t.same(config.isBypassedIP("::1"), true);
  t.same(config.isBypassedIP("::2"), false);

  config.updateConfig([], 0, [], []);

  t.same(config.isBypassedIP("123.123.123.1"), false);
  t.same(config.isBypassedIP("999.999.999.999"), false);
});

t.test("it sets and updates monitored IP lists", async (t) => {
  const config = new ServiceConfig([], 0, [], [], [], []);

  t.same(config.getMatchingMonitoredIPListKeys("9.9.9.9"), []);
  t.same(config.getMatchingMonitoredIPListKeys("1.2.3.4"), []);

  config.updateMonitoredIPAddresses([
    {
      key: "tor/exit_nodes",
      source: "tor",
      description: "due to tor usage",
      ips: ["1.2.3.0/24", "9.9.9.9"],
    },
  ]);

  t.same(config.getMatchingMonitoredIPListKeys("9.9.9.9"), ["tor/exit_nodes"]);
  t.same(config.getMatchingMonitoredIPListKeys("1.2.3.4"), ["tor/exit_nodes"]);

  config.updateMonitoredIPAddresses([]);

  t.same(config.getMatchingMonitoredIPListKeys("9.9.9.9"), []);
  t.same(config.getMatchingMonitoredIPListKeys("1.2.3.4"), []);
});

t.test("it returns matching IP lists keys", async (t) => {
  const config = new ServiceConfig([], 0, [], [], [], []);

  config.updateMonitoredIPAddresses([
    {
      key: "tor/exit_nodes",
      source: "tor",
      description: "due to tor usage",
      ips: ["9.9.9.9"],
    },
    {
      key: "known_threat_actors/public_scanners",
      source: "tor",
      description: "due to tor usage",
      ips: ["9.9.9.9/32"],
    },
  ]);

  config.updateBlockedIPAddresses([
    {
      key: "geoip/Belgium;BE",
      source: "geoip",
      description: "description",
      ips: ["8.8.8.8"],
    },
    {
      key: "geoip/Germany;DE",
      source: "geoip",
      description: "description",
      ips: ["8.8.8.8/32"],
    },
  ]);

  config.updateAllowedIPAddresses([
    {
      key: "geoip/Belgium;BE",
      source: "geoip",
      description: "description",
      ips: ["7.7.7.7"],
    },
  ]);

  t.same(config.getMatchingBlockedIPListKeys("9.9.9.9"), []);
  t.same(config.getMatchingMonitoredIPListKeys("9.9.9.9"), [
    "tor/exit_nodes",
    "known_threat_actors/public_scanners",
  ]);
  t.same(config.getMatchingBlockedIPListKeys("8.8.8.8"), [
    "geoip/Belgium;BE",
    "geoip/Germany;DE",
  ]);
  t.same(config.getMatchingMonitoredIPListKeys("8.8.8.8"), []);
  t.same(config.getMatchingBlockedIPListKeys("7.7.7.7"), []);
  t.same(config.getMatchingMonitoredIPListKeys("7.7.7.7"), []);
});

t.test("should return all matching user agent patterns", async (t) => {
  const config = new ServiceConfig([], 0, [], [], [], []);
  config.updateUserAgentDetails([
    {
      key: "list1",
      pattern: "a|b|c",
    },
    {
      key: "list2",
      pattern: "b",
    },
  ]);
  t.same(config.getMatchingUserAgentKeys("a"), ["list1"]);
  t.same(config.getMatchingUserAgentKeys("A"), ["list1"]);
  t.same(config.getMatchingUserAgentKeys("b"), ["list1", "list2"]);
  t.same(config.getMatchingUserAgentKeys("c"), ["list1"]);
  t.same(config.getMatchingUserAgentKeys("d"), []);
});

t.test("it clears RegExp when updating with empty pattern", async (t) => {
  const config = new ServiceConfig([], 0, [], [], [], []);
  config.updateBlockedUserAgents("googlebot");
  config.updateMonitoredUserAgents("googlebot");
  config.updateUserAgentDetails([
    {
      key: "googlebot",
      pattern: "googlebot",
    },
  ]);

  config.updateBlockedUserAgents("");
  config.updateMonitoredUserAgents("");
  config.updateUserAgentDetails([]);

  t.same(config.isMonitoredUserAgent("googlebot"), false);
  t.same(config.isUserAgentBlocked("googlebot"), { blocked: false });
  t.same(config.getMatchingUserAgentKeys("googlebot"), []);
});

t.test(
  "it does not throw error when updating user agent lists with invalid patterns",
  async (t) => {
    const config = new ServiceConfig([], 0, [], [], [], []);

    config.updateBlockedUserAgents("googlebot");
    config.updateMonitoredUserAgents("googlebot");
    config.updateUserAgentDetails([
      {
        key: "googlebot",
        pattern: "googlebot",
      },
    ]);

    config.updateBlockedUserAgents("[");
    config.updateMonitoredUserAgents("[");
    config.updateUserAgentDetails([
      {
        key: "googlebot",
        pattern: "[",
      },
    ]);

    t.same(config.isMonitoredUserAgent("googlebot"), false);
    t.same(config.isUserAgentBlocked("googlebot"), { blocked: false });
    t.same(config.getMatchingUserAgentKeys("googlebot"), []);
  }
);

t.test("outbound request blocking", async (t) => {
  const config = new ServiceConfig([], 0, [], [], false, [], []);

  t.same(config.shouldBlockOutgoingRequest("example.com"), false);

  config.setBlockNewOutgoingRequests(true);
  t.same(config.shouldBlockOutgoingRequest("example.com"), true);

  config.updateDomains([
    { hostname: "example.com", mode: "allow" },
    { hostname: "aikido.dev", mode: "block" },
  ]);
  t.same(config.shouldBlockOutgoingRequest("example.com"), false);
  t.same(config.shouldBlockOutgoingRequest("aikido.dev"), true);
  t.same(config.shouldBlockOutgoingRequest("unknown.com"), true);

  config.updateDomains([
    { hostname: "example.com", mode: "block" },
    { hostname: "aikido.dev", mode: "allow" },
  ]);
  t.same(config.shouldBlockOutgoingRequest("example.com"), true);
  t.same(config.shouldBlockOutgoingRequest("aikido.dev"), false);
  t.same(config.shouldBlockOutgoingRequest("unknown.com"), true);

  config.setBlockNewOutgoingRequests(false);

  t.same(config.shouldBlockOutgoingRequest("example.com"), true);
  t.same(config.shouldBlockOutgoingRequest("aikido.dev"), false);
  t.same(config.shouldBlockOutgoingRequest("unknown.com"), false);
});
