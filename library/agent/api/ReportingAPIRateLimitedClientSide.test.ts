import * as t from "tap";
import { ReportingAPIForTesting } from "./ReportingAPIForTesting";
import { ReportingAPIRateLimitedClientSide } from "./ReportingAPIRateLimitedClientSide";
import { Token } from "./Token";
import { Event } from "./Event";

function generateAttackEvent(): Event {
  return {
    type: "detected_attack",
    time: Date.now(),
    request: {
      url: undefined,
      method: undefined,
      ipAddress: undefined,
      userAgent: undefined,
      // @ts-expect-error Test
      headers: undefined,
      body: undefined,
      source: "express",
      route: "/posts/:id",
    },
    attack: {
      module: "module",
      blocked: false,
      source: "body",
      path: "path",
      stack: "stack",
      kind: "nosql_injection",
      metadata: {},
      operation: "operation",
      payload: "payload",
      user: undefined,
    },
    agent: {
      version: "1.0.0",
      library: "firewall-node",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
      platform: {
        version: "version",
        arch: "arch",
      },
    },
  };
}

function generateAttackWaveEvent(): Event {
  return {
    type: "detected_attack_wave",
    time: Date.now(),
    request: {
      ipAddress: "::1",
      userAgent: undefined,
      source: "express",
    },
    attack: {
      metadata: {},
      user: undefined,
    },
    agent: {
      version: "1.0.0",
      library: "firewall-node",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
      platform: {
        version: "version",
        arch: "arch",
      },
    },
  };
}

function generateCustomEvent(name: string, route: string): Event {
  return {
    type: "custom",
    name,
    time: Date.now(),
    request: {
      method: "POST",
      ipAddress: "1.2.3.4",
      userAgent: "test-agent",
      source: "express",
      route,
    },
    agent: generateAttackEvent().agent,
  };
}

t.test("it throttles attack events", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");

  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 5);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 6);
});

function generateStartedEvent(): Event {
  return {
    type: "started",
    time: Date.now(),
    agent: {
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
      serverless: false,
      library: "firewall-node",
      platform: {
        version: "version",
        arch: "arch",
      },
    },
  };
}

t.test("it throttles custom events across names and requests", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 2,
    intervalInMs: 60_000,
    eventGroup: "custom",
  });

  await throttled.report(
    token,
    generateCustomEvent("user.login_failed", "/login"),
    5000
  );
  await throttled.report(
    token,
    generateCustomEvent("payment.failed", "/checkout"),
    5000
  );
  const result = await throttled.report(
    token,
    generateCustomEvent("user.signed_up", "/signup"),
    5000
  );

  t.same(result, { success: false, error: "max_custom_events_reached" });
  t.same(
    api.getEvents().map((event) => event.type),
    ["custom", "custom"]
  );

  await throttled.report(token, generateAttackEvent(), 5000);
  t.equal(api.getEvents().length, 3);
});

t.test("it always allows started events", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");

  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateStartedEvent(), 5000);
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateStartedEvent(), 5000);
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateStartedEvent(), 5000);
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateStartedEvent(), 5000);
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateStartedEvent(), 5000);
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateStartedEvent(), 5000);
  t.same(api.getEvents().length, 6);
});

function generateHeartbeatEvent(): Event {
  return {
    type: "heartbeat",
    time: Date.now(),
    stats: {
      endedAt: 0,
      startedAt: 0,
      operations: {},
      requests: {
        total: 0,
        aborted: 0,
        rateLimited: 0,
        attacksDetected: {
          blocked: 0,
          total: 0,
        },
        attackWaves: {
          blocked: 0,
          total: 0,
        },
      },
      userAgents: {
        breakdown: {},
      },
      ipAddresses: {
        breakdown: {},
      },
    },
    agent: {
      version: "1.0.0",
      dryMode: false,
      hostname: "hostname",
      packages: {},
      ipAddress: "ipAddress",
      preventedPrototypePollution: false,
      nodeEnv: "",
      os: {
        name: "os",
        version: "version",
      },
      serverless: false,
      incompatiblePackages: {
        prototypePollution: {},
      },
      stack: [],
      library: "firewall-node",
      platform: {
        version: "version",
        arch: "arch",
      },
    },
    hostnames: [],
    routes: [],
    users: [],
    packages: [],
    ai: [],
  };
}

t.test("it always allows heartbeat events", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");

  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateHeartbeatEvent(), 5000);
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateHeartbeatEvent(), 5000);
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateHeartbeatEvent(), 5000);
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateHeartbeatEvent(), 5000);
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateHeartbeatEvent(), 5000);
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateHeartbeatEvent(), 5000);
  t.same(api.getEvents().length, 6);
});

t.test("it does not blow memory", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");
  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 10,
    intervalInMs: 60000,
  });

  for (let i = 0; i < 10; i++) {
    t.same(await throttled.report(token, generateAttackEvent(), 5000), {
      success: true,
      endpoints: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      allowedIPAddresses: [],
      blockNewOutgoingRequests: false,
      domains: [],
      excludedUserIdsFromRateLimiting: [],
    });
  }

  for (let i = 0; i < 100; i++) {
    const result = await throttled.report(token, generateAttackEvent(), 5000);
    if (result.success) {
      t.fail(
        `Expected to be rate limited at index ${i}: ${JSON.stringify(result)}`
      );
    }
  }

  // @ts-expect-error Private field but we need to check the length
  t.same(throttled.events.length, 10);
});

t.test("it throttles attack wave events", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");

  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 5);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 6);
});

t.test("it throttles both event types at the same time", async () => {
  const api = new ReportingAPIForTesting();
  const token = new Token("123");

  const throttled = new ReportingAPIRateLimitedClientSide(api, {
    maxEventsPerInterval: 5,
    intervalInMs: 1000,
  });

  t.same(api.getEvents().length, 0);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 1);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 2);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 3);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 4);
  await throttled.report(token, generateAttackWaveEvent(), 5000);
  t.same(api.getEvents().length, 5);
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 5);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await throttled.report(token, generateAttackEvent(), 5000);
  t.same(api.getEvents().length, 6);
});
