import { percentiles } from "../helpers/percentiles";

type ModuleCompressedTimings = {
  averageInMS: number;
  percentiles: Record<string, number>;
  datetime: {
    start: number;
    end: number;
  };
};

type ModuleStats = {
  withoutContext: number;
  total: number;
  timings: { durations: number[]; firstCallAt: number; lastCallAt: number };
  compressedTimings: ModuleCompressedTimings[];
  interceptorThrewError: number;
  attacksDetected: {
    total: number;
    blocked: number;
  };
};

type ModuleStatsWithoutTimings = Omit<ModuleStats, "timings">;

export class InspectionStatistics {
  private stats: Record<string, ModuleStats> = {};
  private readonly maxPerfSamplesInMemory: number;
  private readonly maxCompressedStatsInMemory: number;

  constructor({
    maxPerfSamplesInMemory,
    maxCompressedStatsInMemory,
  }: {
    maxPerfSamplesInMemory: number;
    maxCompressedStatsInMemory: number;
  }) {
    this.maxPerfSamplesInMemory = maxPerfSamplesInMemory;
    this.maxCompressedStatsInMemory = maxCompressedStatsInMemory;
  }

  hasCompressedStats() {
    return Object.values(this.stats).some(
      (moduleStats) => moduleStats.compressedTimings.length > 0
    );
  }

  getStats(): Record<string, ModuleStatsWithoutTimings> {
    const stats: Record<string, ModuleStatsWithoutTimings> = {};
    for (const module in this.stats) {
      const moduleStats = this.stats[module];
      stats[module] = {
        total: moduleStats.total,
        attacksDetected: {
          total: moduleStats.attacksDetected.total,
          blocked: moduleStats.attacksDetected.blocked,
        },
        interceptorThrewError: moduleStats.interceptorThrewError,
        withoutContext: moduleStats.withoutContext,
        compressedTimings: moduleStats.compressedTimings,
      };
    }

    return stats;
  }

  private ensureModuleStats(module: string) {
    if (!this.stats[module]) {
      this.stats[module] = {
        withoutContext: 0,
        total: 0,
        timings: {
          durations: [],
          firstCallAt: Date.now(),
          lastCallAt: Date.now(),
        },
        compressedTimings: [],
        interceptorThrewError: 0,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      };
    }
  }

  private compressPerfSamples(module: string) {
    if (!this.stats[module]) {
      return;
    }

    if (this.stats[module].timings.durations.length === 0) {
      return;
    }

    const timings = this.stats[module].timings;
    const averageInMS =
      timings.durations.reduce((acc, curr) => acc + curr, 0) /
      timings.durations.length;

    const [p50, p75, p90, p95, p99] = percentiles(
      [50, 75, 90, 95, 99],
      timings.durations
    );

    this.stats[module].compressedTimings.push({
      averageInMS,
      percentiles: {
        "50": p50,
        "75": p75,
        "90": p90,
        "95": p95,
        "99": p99,
      },
      datetime: {
        start: timings.firstCallAt,
        end: timings.lastCallAt,
      },
    });

    if (
      this.stats[module].compressedTimings.length >
      this.maxCompressedStatsInMemory
    ) {
      this.stats[module].compressedTimings.shift();
    }

    this.stats[module].timings.durations = [];
    this.stats[module].timings.firstCallAt = Date.now();
    this.stats[module].timings.lastCallAt = Date.now();
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

    if (
      this.stats[module].timings.durations.length >= this.maxPerfSamplesInMemory
    ) {
      this.compressPerfSamples(module);
    }

    this.stats[module].timings.durations.push(durationInMs);
    this.stats[module].timings.lastCallAt = Date.now();

    if (attackDetected) {
      this.stats[module].attacksDetected.total += 1;
      if (blocked) {
        this.stats[module].attacksDetected.blocked += 1;
      }
    }
  }
}
