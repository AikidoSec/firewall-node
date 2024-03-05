import { percentiles } from "../helpers/percentiles";

type ModuleStats = {
  withoutContext: number;
  total: number;
  timings: number[];
  interceptorThrewError: number;
  attacksDetected: {
    total: number;
    blocked: number;
  };
};

type ModuleStatsEnriched = {
  averageInMS: number;
  percentiles: Record<string, number>;
} & Omit<ModuleStats, "timings">;

export class InspectionStatistics {
  private stats: Record<string, ModuleStats> = {};
  private readonly maxTimings: number;

  constructor({ maxTimings }: { maxTimings: number }) {
    this.maxTimings = maxTimings;
  }

  reachedMaxTimings() {
    return Object.values(this.stats).some(
      (moduleStats) => moduleStats.timings.length >= this.maxTimings
    );
  }

  getStats(): Record<string, ModuleStatsEnriched> {
    const stats: Record<string, ModuleStatsEnriched> = {};

    for (const module in this.stats) {
      const moduleStats = this.stats[module];
      const timings = moduleStats.timings;

      const averageInMS =
        timings.reduce((acc, curr) => acc + curr, 0) / timings.length;

      stats[module] = {
        total: moduleStats.total,
        attacksDetected: {
          total: moduleStats.attacksDetected.total,
          blocked: moduleStats.attacksDetected.blocked,
        },
        interceptorThrewError: moduleStats.interceptorThrewError,
        withoutContext: moduleStats.withoutContext,
        averageInMS,
        percentiles: {},
      };

      if (timings.length > 0) {
        const [p50, p75, p90, p95] = percentiles([50, 75, 90, 99], timings);
        stats[module].percentiles = {
          "50": p50,
          "75": p75,
          "90": p90,
          "95": p95,
        };
      }
    }

    return stats;
  }

  private ensureModuleStats(module: string) {
    if (!this.stats[module]) {
      this.stats[module] = {
        withoutContext: 0,
        total: 0,
        timings: [],
        interceptorThrewError: 0,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      };
    }
  }

  inspectedCallWithoutContext(module: string) {
    this.ensureModuleStats(module);
    this.stats[module].total += 1;
    this.stats[module].withoutContext += 1;
  }

  interceptorThrewError(module: string) {
    this.ensureModuleStats(module);
    this.stats[module].total += 1;
    this.stats[module].interceptorThrewError += 1;
  }

  onInspectedCall({
    module,
    blocked,
    attackDetected,
    durationInMs,
  }: {
    module: string;
    durationInMs: number;
    attackDetected: boolean;
    blocked: boolean;
  }) {
    this.ensureModuleStats(module);

    this.stats[module].total += 1;
    this.stats[module].timings.push(durationInMs);

    if (this.stats[module].timings.length > this.maxTimings) {
      this.stats[module].timings.shift();
    }

    if (attackDetected) {
      this.stats[module].attacksDetected.total += 1;
      if (blocked) {
        this.stats[module].attacksDetected.blocked += 1;
      }
    }
  }
}
