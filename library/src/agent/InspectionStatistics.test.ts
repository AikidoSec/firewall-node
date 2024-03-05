import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it keeps track of amount of calls", async () => {
  const stats = new InspectionStatistics({
    maxTimings: 50,
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
      averageInMS: 0.1,
      percentiles: {
        50: 0.1,
        75: 0.1,
        90: 0.1,
        95: 0.1,
      },
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
      averageInMS: 0.1,
      percentiles: {
        50: 0.1,
        75: 0.1,
        90: 0.1,
        95: 0.1,
      },
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
      averageInMS: 0.1,
      percentiles: {
        50: 0.1,
        75: 0.1,
        90: 0.1,
        95: 0.1,
      },
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
      averageInMS: 0.1,
      percentiles: {
        50: 0.1,
        75: 0.1,
        90: 0.1,
        95: 0.1,
      },
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
      averageInMS: 0.16666666666666666,
      percentiles: {
        50: 0.1,
        75: 0.3,
        90: 0.3,
        95: 0.3,
      },
    },
  });

  t.same(stats.reachedMaxTimings(), false);

  for (let i = 0; i < 50; i++) {
    stats.onInspectedCall({
      module: "mongodb",
      blocked: false,
      durationInMs: 0.1,
      attackDetected: false,
    });
  }

  t.same(stats.reachedMaxTimings(), true);

  // @ts-expect-error Stats is private
  t.same(stats.stats.mongodb.timings.length, 50);
});
