import * as FakeTimers from "@sinonjs/fake-timers";
import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it keeps track of amount of calls", async () => {
  const clock = FakeTimers.install();

  const maxPerfSamplesInMemory = 50;
  const stats = new InspectionStatistics({
    maxPerfSamplesInMemory: maxPerfSamplesInMemory,
  });

  t.same(stats.getStats(), {});

  stats.onInspectedCall({
    module: "mongodb",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: false,
  });

  t.same(stats.getStats(), {
    mongodb: {
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
      interceptorThrewError: 0,
      withoutContext: 0,
      total: 1,
      compressedTimings: [],
    },
  });

  stats.inspectedCallWithoutContext("mongodb");

  t.same(stats.getStats(), {
    mongodb: {
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
      interceptorThrewError: 0,
      withoutContext: 1,
      total: 2,
      compressedTimings: [],
    },
  });

  stats.interceptorThrewError("mongodb");

  t.same(stats.getStats(), {
    mongodb: {
      attacksDetected: {
        total: 0,
        blocked: 0,
      },
      interceptorThrewError: 1,
      withoutContext: 1,
      total: 3,
      compressedTimings: [],
    },
  });

  stats.onInspectedCall({
    module: "mongodb",
    blocked: false,
    durationInMs: 0.1,
    attackDetected: true,
  });

  t.same(stats.getStats(), {
    mongodb: {
      attacksDetected: {
        total: 1,
        blocked: 0,
      },
      interceptorThrewError: 1,
      withoutContext: 1,
      total: 4,
      compressedTimings: [],
    },
  });

  stats.onInspectedCall({
    module: "mongodb",
    blocked: true,
    durationInMs: 0.3,
    attackDetected: true,
  });

  t.same(stats.getStats(), {
    mongodb: {
      attacksDetected: {
        total: 2,
        blocked: 1,
      },
      interceptorThrewError: 1,
      withoutContext: 1,
      total: 5,
      compressedTimings: [],
    },
  });

  t.same(stats.hasCompressedStats(), false);

  clock.tick(1000);

  for (let i = 0; i < 50; i++) {
    stats.onInspectedCall({
      module: "mongodb",
      blocked: false,
      durationInMs: i * 0.1,
      attackDetected: false,
    });
  }

  t.same(stats.hasCompressedStats(), true);
  t.same(stats.getStats(), {
    mongodb: {
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
          datetime: {
            start: 0,
            end: 1000,
          },
        },
      ],
    },
  });

  // @ts-expect-error Stats is private
  t.ok(stats.stats.mongodb.timings.durations.length < maxPerfSamplesInMemory);

  clock.uninstall();
});
