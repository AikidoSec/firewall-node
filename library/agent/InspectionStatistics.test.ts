import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it resets stats", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

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

  const stats = new InspectionStatistics();

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

  clock.uninstall();
});

t.test("it keeps track of requests", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

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

t.test("it keeps track of aborted requests", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

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

t.test("it keeps track of matched IPs and user agents", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

  stats.onIPAddressMatches(["known_threat_actors/public_scanners"]);
  stats.onUserAgentMatches(["ai_data_scrapers"]);

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
      breakdown: {
        // eslint-disable-next-line camelcase
        ai_data_scrapers: 1,
      },
    },
    ipAddresses: {
      breakdown: {
        "known_threat_actors/public_scanners": 1,
      },
    },
  });

  // Test multiple occurrences
  stats.onIPAddressMatches(["known_threat_actors/public_scanners"]);
  stats.onUserAgentMatches(["ai_data_scrapers"]);

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
      breakdown: {
        // eslint-disable-next-line camelcase
        ai_data_scrapers: 2,
      },
    },
    ipAddresses: {
      breakdown: {
        "known_threat_actors/public_scanners": 2,
      },
    },
  });

  clock.uninstall();
});

t.test("it keeps track of multiple operations of the same kind", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

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

  clock.uninstall();
});

t.test("it handles empty operation strings", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

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
    userAgents: {
      breakdown: {},
    },
    ipAddresses: {
      breakdown: {},
    },
  });

  clock.uninstall();
});
