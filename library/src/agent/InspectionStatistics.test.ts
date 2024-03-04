import * as t from "tap";
import { InspectionStatistics } from "./InspectionStatistics";

t.test("it keeps track of amount of calls", async () => {
  const stats = new InspectionStatistics({
    maxAverageInMS: 0.1,
    maxSamples: 50,
  });

  t.same(stats.getStats(), {});

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: false,
    duration: 0.1,
    blocked: false,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 0,
      allowed: 1,
      withoutContext: 0,
      total: 1,
    },
  });

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: true,
    detectedAttack: false,
    duration: 0.1,
    blocked: false,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 0,
      allowed: 2,
      withoutContext: 1,
      total: 2,
    },
  });

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: true,
    duration: 0.1,
    blocked: true,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 1,
      allowed: 2,
      withoutContext: 1,
      total: 3,
    },
  });

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: true,
    duration: 0.1,
    blocked: true,
  });

  t.same(stats.getStats(), {
    mongodb: {
      blocked: 2,
      allowed: 2,
      withoutContext: 1,
      total: 4,
    },
  });
});

t.test("it keep track of last X calls ", async () => {
  const stats = new InspectionStatistics({
    maxSamples: 50,
    maxAverageInMS: 0.1,
  });

  for (const _ of Array.from({ length: 49 })) {
    stats.onInspectedCall({
      module: "mongodb",
      withoutContext: false,
      detectedAttack: false,
      duration: 0.2,
      blocked: false,
    });
    t.same(stats.shouldStopInspectingCalls("mongodb"), false);
  }

  stats.onInspectedCall({
    module: "mongodb",
    withoutContext: false,
    detectedAttack: false,
    duration: 0.2,
    blocked: false,
  });
  t.same(stats.shouldStopInspectingCalls("mongodb"), true);

  stats.cleanupTimings("mongodb");
  t.same(stats.shouldStopInspectingCalls("mongodb"), false);
});

t.test("it stays under the average", async () => {
  const stats = new InspectionStatistics({
    maxSamples: 50,
    maxAverageInMS: 0.1,
  });

  for (const _ of Array.from({ length: 50 })) {
    stats.onInspectedCall({
      module: "mongodb",
      withoutContext: false,
      detectedAttack: false,
      duration: 0.05,
      blocked: false,
    });
  }

  t.same(stats.shouldStopInspectingCalls("mongodb"), false);
});
