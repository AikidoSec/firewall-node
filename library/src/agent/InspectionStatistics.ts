import { percentiles } from "../helpers/percentiles";

type ModuleStats = {
  blocked: number;
  allowed: number;
  withoutContext: number;
  total: number;
  timings: number[];
};

type ModuleStatsEnriched = {
  averageInMS: number;
  percentiles: Record<string, number>;
} & Omit<ModuleStats, "timings">;

type InspectCallArguments =
  | {
      module: string;
      withoutContext: false;
      blocked: boolean;
      durationInMs: number;
    }
  | {
      module: string;
      withoutContext: true;
    };

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
        blocked: moduleStats.blocked,
        allowed: moduleStats.allowed,
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

  onInspectedCall(args: InspectCallArguments) {
    const { module } = args;

    if (!this.stats[module]) {
      this.stats[module] = {
        blocked: 0,
        allowed: 0,
        withoutContext: 0,
        total: 0,
        timings: [],
      };
    }

    this.stats[module].total += 1;

    if (args.withoutContext) {
      this.stats[module].withoutContext += 1;
      this.stats[module].allowed += 1;
      return;
    }

    this.stats[module].timings.push(args.durationInMs);

    if (this.stats[module].timings.length > this.maxTimings) {
      this.stats[module].timings.shift();
    }

    if (args.blocked) {
      this.stats[module].blocked += 1;
    } else {
      this.stats[module].allowed += 1;
    }
  }
}
