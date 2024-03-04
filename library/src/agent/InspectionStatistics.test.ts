import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it keeps track of amount of calls", async () => {
  const stats = new InspectionStatistics({
    maxTimings: 50,
  });

  t.same(stats.getStats(), {});

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    blocked: false,
    durationInMs: 0.1,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 0,
      allowed: 1,
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

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: true,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 0,
      allowed: 2,
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

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    blocked: true,
    durationInMs: 0.5,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 1,
      allowed: 2,
      withoutContext: 1,
      total: 3,
      averageInMS: 0.3,
      percentiles: {
        50: 0.1,
        75: 0.5,
        90: 0.5,
        95: 0.5,
      },
    },
  });

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    blocked: true,
    durationInMs: 0.3,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 2,
      allowed: 2,
      withoutContext: 1,
      total: 4,
      averageInMS: 0.3,
      percentiles: {
        50: 0.3,
        75: 0.5,
        90: 0.5,
        95: 0.5,
      },
    },
  });

  t.same(stats.reachedMaxTimings(), false);

  for (let i = 0; i < 50; i++) {
    stats.onInspectedCall({
      module: "mongodb",
      withoutContext: false,
      blocked: false,
      durationInMs: 0.1,
    });
  }

  t.same(stats.reachedMaxTimings(), true);

  // @ts-expect-error Stats is private
  t.same(stats.stats.mongodb.timings.length, 50);
});
