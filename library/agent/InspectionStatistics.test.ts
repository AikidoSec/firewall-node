import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it resets stats", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

  stats.onInspectedCall({
    withoutContext: false,
    sink: "mongodb",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
  });

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
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
  });

  clock.tick(1000);
  stats.reset();
  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 1000,
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

t.test("it keeps track of amount of calls", async () => {
  const clock = FakeTimers.install();

  const maxPerfSamplesInMemory = 50;
  const maxCompressedStatsInMemory = 5;
  const stats = new InspectionStatistics();

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
  });

  stats.onInspectedCall({
    withoutContext: false,
    sink: "mongodb",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
  });

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
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
  });

  stats.onInspectedCall({
    withoutContext: true,
    sink: "mongodb",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
  });

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
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
  });

  stats.interceptorThrewError("mongodb");

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
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
  });

  stats.onInspectedCall({
    withoutContext: false,
    sink: "mongodb",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: true,
  });

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
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
  });

  stats.onInspectedCall({
    withoutContext: false,
    sink: "mongodb",
    blocked: true,
    durationInMs: 0.3,
    attackDetected: true,
  });

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
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
  });

  clock.tick(1000);

  for (let i = 0; i < maxPerfSamplesInMemory; i++) {
    stats.onInspectedCall({
      withoutContext: false,
      sink: "mongodb",
      blocked: false,
      durationInMs: i * 0.1,
      attackDetected: false,
    });
  }

  t.same(stats.getStats(), {
    sinks: {
      mongodb: {
        attacksDetected: {
          total: 2,
          blocked: 1,
        },
        interceptorThrewError: 1,
        withoutContext: 1,
        total: 55,
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

  for (
    let i = 0;
    i < maxPerfSamplesInMemory * maxCompressedStatsInMemory * 2;
    i++
  ) {
    stats.onInspectedCall({
      withoutContext: false,
      sink: "mongodb",
      blocked: false,
      durationInMs: i * 0.1,
      attackDetected: false,
    });
  }

  clock.uninstall();
});

t.test("it keeps track of requests", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

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
  });

  stats.onRequest();

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 1,
      aborted: 0,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
  });

  stats.onRequest();
  stats.onDetectedAttack({ blocked: false });

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 2,
      aborted: 0,
      attacksDetected: {
        total: 1,
        blocked: 0,
      },
    },
  });

  stats.onRequest();
  stats.onDetectedAttack({ blocked: true });

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 3,
      aborted: 0,
      attacksDetected: {
        total: 2,
        blocked: 1,
      },
    },
  });

  clock.tick(1000);

  stats.reset();

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 1000,
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

t.test("it keeps track of aborted requests", async () => {
  const clock = FakeTimers.install();

  const stats = new InspectionStatistics();

  stats.onAbortedRequest();

  t.same(stats.getStats(), {
    sinks: {},
    startedAt: 0,
    requests: {
      total: 0,
      aborted: 1,
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
    },
  });

  clock.uninstall();
});
