import { percentiles } from "../helpers/percentiles";
import { OperationKind } from "./api/Event";

type OperationCompressedTimings = {
  averageInMS: number;
  percentiles: Record<string, number>;
  compressedAt: number;
};

type OperationStats = {
  kind: OperationKind;
  withoutContext: number;
  total: number;
  // array where we accumulate durations for each sink-request (e.g. mysql.query)
  durations: number[];
  // array where we put compressed blocks of stats
  compressedTimings: OperationCompressedTimings[];
  interceptorThrewError: number;
  attacksDetected: {
    total: number;
    blocked: number;
  };
};

type OperationStatsWithoutTimings = Omit<OperationStats, "durations">;

export class InspectionStatistics {
  private startedAt = Date.now();
  private operations: Record<string, OperationStats> = {};
  private readonly maxPerfSamplesInMemory: number;
  private readonly maxCompressedStatsInMemory: number;
  private requests: {
    total: number;
    aborted: number;
    attacksDetected: {
      total: number;
      blocked: number;
    };
  } = { total: 0, aborted: 0, attacksDetected: { total: 0, blocked: 0 } };

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
    return Object.values(this.operations).some(
      (sinkStats) => sinkStats.compressedTimings.length > 0
    );
  }

  isEmpty() {
    return (
      this.requests.total === 0 &&
      Object.keys(this.operations).length === 0 &&
      this.requests.attacksDetected.total === 0
    );
  }

  reset() {
    this.operations = {};
    this.requests = {
      total: 0,
      aborted: 0,
      attacksDetected: { total: 0, blocked: 0 },
    };
    this.startedAt = Date.now();
  }

  getStats(): {
    operations: OperationStatsWithoutTimings[];
    startedAt: number;
    requests: {
      total: number;
      aborted: number;
      attacksDetected: {
        total: number;
        blocked: number;
      };
    };
  } {
    const operations: OperationStatsWithoutTimings[] = [];
    for (const kind in this.operations) {
      const stats = this.operations[kind];
      operations.push({
        kind: stats.kind,
        withoutContext: stats.withoutContext,
        interceptorThrewError: stats.interceptorThrewError,
        total: stats.total,
        attacksDetected: {
          total: stats.attacksDetected.total,
          blocked: stats.attacksDetected.blocked,
        },
        compressedTimings: stats.compressedTimings,
      });
    }

    return {
      operations: operations,
      startedAt: this.startedAt,
      requests: this.requests,
    };
  }

  private ensureOperationStats(kind: OperationKind) {
    if (!this.operations[kind]) {
      this.operations[kind] = {
        withoutContext: 0,
        kind: kind,
        total: 0,
        durations: [],
        compressedTimings: [],
        interceptorThrewError: 0,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      };
    }
  }

  private compressPerfSamples(kind: OperationKind) {
    /* c8 ignore start */
    if (!this.operations[kind]) {
      return;
    }

    if (this.operations[kind].durations.length === 0) {
      return;
    }
    /* c8 ignore stop */

    const timings = this.operations[kind].durations;
    const averageInMS =
      timings.reduce((acc, curr) => acc + curr, 0) / timings.length;

    const [p50, p75, p90, p95, p99] = percentiles(
      [50, 75, 90, 95, 99],
      timings
    );

    this.operations[kind].compressedTimings.push({
      averageInMS,
      percentiles: {
        "50": p50,
        "75": p75,
        "90": p90,
        "95": p95,
        "99": p99,
      },
      compressedAt: Date.now(),
    });

    if (
      this.operations[kind].compressedTimings.length >
      this.maxCompressedStatsInMemory
    ) {
      this.operations[kind].compressedTimings.shift();
    }

    this.operations[kind].durations = [];
  }

  interceptorThrewError(kind: OperationKind) {
    this.ensureOperationStats(kind);
    this.operations[kind].total += 1;
    this.operations[kind].interceptorThrewError += 1;
  }

  onDetectedAttack({ blocked }: { blocked: boolean }) {
    this.requests.attacksDetected.total += 1;
    if (blocked) {
      this.requests.attacksDetected.blocked += 1;
    }
  }

  onAbortedRequest() {
    this.requests.aborted += 1;
  }

  onRequest() {
    this.requests.total += 1;
  }

  onInspectedCall({
    kind,
    blocked,
    attackDetected,
    durationInMs,
    withoutContext,
  }: {
    kind: OperationKind;
    durationInMs: number;
    attackDetected: boolean;
    blocked: boolean;
    withoutContext: boolean;
  }) {
    this.ensureOperationStats(kind);

    this.operations[kind].total += 1;

    if (withoutContext) {
      this.operations[kind].withoutContext += 1;
      return;
    }

    if (this.operations[kind].durations.length >= this.maxPerfSamplesInMemory) {
      this.compressPerfSamples(kind);
    }

    this.operations[kind].durations.push(durationInMs);

    if (attackDetected) {
      this.operations[kind].attacksDetected.total += 1;
      if (blocked) {
        this.operations[kind].attacksDetected.blocked += 1;
      }
    }
  }

  forceCompress() {
    for (const kind in this.operations) {
      this.compressPerfSamples(kind as OperationKind);
    }
  }
}
