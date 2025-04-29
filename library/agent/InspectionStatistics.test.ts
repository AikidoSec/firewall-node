import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it resets stats", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 0,
        withoutContext: 0,
        total: 1,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  clock.tick(1000);
  stats.reset();
  t.same(stats.getStats(), {
    operations: {},
    startedAt: 1000,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  clock.uninstall();
});

t.test("it keeps track of amount of calls", async () => {
  const clock = FakeTimers.install();

  const maxPerfSamplesInMemory = 50;
  const maxCompressedStatsInMemory = 5;
  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: maxPerfSamplesInMemory,
    maxCompressedStatsInMemory: maxCompressedStatsInMemory,
  });

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 0,
        withoutContext: 0,
        total: 1,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onInspectedCall({
    withoutContext: true,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 0,
        withoutContext: 1,
        total: 2,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.interceptorThrewError("mongodb.query", "nosql_op");

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 1,
        withoutContext: 1,
        total: 3,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: true,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 1,
          blocked: 0,
        },
        interceptorThrewError: 1,
        withoutContext: 1,
        total: 4,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: true,
    durationInMs: 0.3,
    attackDetected: true,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 2,
          blocked: 1,
        },
        interceptorThrewError: 1,
        withoutContext: 1,
        total: 5,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  t.same(stats.hasCompressedStats(), false);

  clock.tick(1000);

  for (let i = 0; i < maxPerfSamplesInMemory; i++) {
    stats.onInspectedCall({
      withoutContext: false,
      kind: "nosql_op",
      operation: "mongodb.query",
      blocked: false,
      durationInMs: i * 0.1,
      attackDetected: false,
    });
  }

  t.same(stats.hasCompressedStats(), true);
  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 2,
          blocked: 1,
        },
        interceptorThrewError: 1,
        withoutContext: 1,
        total: 55,
        compressedTimings: [
          {
            averageInMS: 2.1719999999999997,
            percentiles: {
              "50": 2.1,
              "75": 3.4000000000000004,
              "90": 4.1000000000000005,
              "95": 4.4,
              "99": 4.6000000000000005,
            },
            compressedAt: 1000,
          },
        ],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  t.ok(
    // @ts-expect-error Stats is private
    stats.operations["mongodb.query"].durations.length < maxPerfSamplesInMemory
  );

  for (
    let i = 0;
    i < maxPerfSamplesInMemory * maxCompressedStatsInMemory * 2;
    i++
  ) {
    stats.onInspectedCall({
      withoutContext: false,
      kind: "nosql_op",
      operation: "mongodb.query",
      blocked: false,
      durationInMs: i * 0.1,
      attackDetected: false,
    });
  }

  t.same(
    // @ts-expect-error Stats is private
    stats.operations["mongodb.query"].compressedTimings.length,
    maxCompressedStatsInMemory
  );

  clock.uninstall();
});

t.test("it keeps track of requests", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onRequest();

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 1,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onRequest();
  stats.onDetectedAttack({ blocked: false });

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 2,
      aborted: 0,
      attacksDetected: {
        total: 1,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onRequest();
  stats.onDetectedAttack({ blocked: true });

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 3,
      aborted: 0,
      attacksDetected: {
        total: 2,
        blocked: 1,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  clock.tick(1000);

  stats.reset();

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 1000,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  clock.uninstall();
});

t.test("it force compresses stats", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  stats.onRequest();

  stats.onInspectedCall({
    withoutContext: false,
    kind: "nosql_op",
    operation: "mongodb.query",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
  });

  t.same(stats.hasCompressedStats(), false);

  stats.forceCompress();

  t.same(stats.hasCompressedStats(), true);

  clock.uninstall();
});

t.test("it keeps track of aborted requests", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  stats.onAbortedRequest();

  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 1,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  clock.uninstall();
});

t.test("it keeps track of blocked IPs and user agents", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  stats.onIPAddressMatches([
    { key: "known_threat_actors/public_scanners", monitor: false },
  ]);
  stats.onUserAgentMatches([{ key: "ai_bots", monitor: false }]);

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {
        // eslint-disable-next-line camelcase
        ai_bots: { total: 1, blocked: 1 },
      },
    },
    ipAddresses: {
      breakdown: {
        "known_threat_actors/public_scanners": { total: 1, blocked: 1 },
      },
    },
  });

  clock.uninstall();
});

t.test("it keeps track of monitored IPs and user agents", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  stats.onIPAddressMatches([
    { key: "known_threat_actors/public_scanners", monitor: true },
  ]);
  stats.onUserAgentMatches([{ key: "ai_data_scrapers", monitor: true }]);

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {
        // eslint-disable-next-line camelcase
        ai_data_scrapers: { total: 1, blocked: 0 },
      },
    },
    ipAddresses: {
      breakdown: {
        "known_threat_actors/public_scanners": { total: 1, blocked: 0 },
      },
    },
  });

  // Test multiple occurrences
  stats.onIPAddressMatches([
    { key: "known_threat_actors/public_scanners", monitor: true },
  ]);
  stats.onUserAgentMatches([{ key: "ai_data_scrapers", monitor: true }]);

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
    userAgents: {
      breakdown: {
        // eslint-disable-next-line camelcase
        ai_data_scrapers: { total: 2, blocked: 0 },
      },
    },
    ipAddresses: {
      breakdown: {
        "known_threat_actors/public_scanners": { total: 2, blocked: 0 },
      },
    },
  });

  clock.uninstall();
});

t.test("should track multiple matches for the same key", (t) => {
  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 100,
    maxCompressedStatsInMemory: 10,
  });

  stats.onIPAddressMatches([
    { key: "known_threat_actors/public_scanners", monitor: true },
    { key: "known_threat_actors/public_scanners", monitor: false },
  ]);
  stats.onUserAgentMatches([
    { key: "ai_data_scrapers", monitor: true },
    { key: "ai_data_scrapers", monitor: false },
  ]);

  const result = stats.getStats();

  t.equal(
    result.ipAddresses.breakdown["known_threat_actors/public_scanners"].total,
    2
  );
  t.equal(
    result.ipAddresses.breakdown["known_threat_actors/public_scanners"].blocked,
    1
  );

  t.equal(result.userAgents.breakdown["ai_data_scrapers"].total, 2);
  t.equal(result.userAgents.breakdown["ai_data_scrapers"].blocked, 1);

  t.end();

  clock.uninstall();
});

t.test("it keeps track of multiple operations of the same kind", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "mongodb.insert",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 0,
        withoutContext: 0,
        total: 1,
        compressedTimings: [],
      },
      "mongodb.insert": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 0,
        withoutContext: 0,
        total: 1,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
  });

  // Test that each operation maintains its own stats
  stats.onInspectedCall({
    withoutContext: true,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "mongodb.query",
    kind: "nosql_op",
  });

  stats.onInspectedCall({
    withoutContext: false,
    blocked: true,
    durationInMs: 0.1,
    attackDetected: true,
    operation: "mongodb.insert",
    kind: "nosql_op",
  });

  t.same(stats.getStats(), {
    operations: {
      "mongodb.query": {
        kind: "nosql_op",
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
        interceptorThrewError: 0,
        withoutContext: 1,
        total: 2,
        compressedTimings: [],
      },
      "mongodb.insert": {
        kind: "nosql_op",
        attacksDetected: {
          total: 1,
          blocked: 1,
        },
        interceptorThrewError: 0,
        withoutContext: 0,
        total: 2,
        compressedTimings: [],
      },
    },
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
  });

  clock.uninstall();
});

t.test("it handles empty operation strings", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: 50,
    maxCompressedStatsInMemory: 5,
  });

  // Test onInspectedCall with empty operation
  stats.onInspectedCall({
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
    operation: "",
    kind: "nosql_op",
  });

  // Test interceptorThrewError with empty operation
  stats.interceptorThrewError("", "nosql_op");

  // Verify no operation was added
  t.same(stats.getStats(), {
    operations: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
  });

  clock.uninstall();
});
