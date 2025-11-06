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
type UserAgentBotKey = string;
type IPListKey = string;

type UserAgentStats = {
  breakdown: Record<UserAgentBotKey, number>;
};

type IPAddressStats = {
  breakdown: Record<IPListKey, number>;
};

export class InspectionStatistics {
  private startedAt = Date.now();
  private operations: Record<string, OperationStats> = {};
  private readonly maxPerfSamplesInMemory: number;
  private readonly maxCompressedStatsInMemory: number;
  private sqlTokenizationFailures: number = 0;
  private requests: {
    total: number;
    aborted: number;
    rateLimited: number;
    attacksDetected: {
      total: number;
      blocked: number;
    };
    attackWaves: {
      total: number;
      blocked: number;
    };
  } = {
    total: 0,
    aborted: 0,
    rateLimited: 0,
    attacksDetected: { total: 0, blocked: 0 },
    attackWaves: {
      total: 0,
      blocked: 0,
    },
  };
  private userAgents: UserAgentStats = {
    breakdown: {},
  };
  private ipAddresses: IPAddressStats = {
    breakdown: {},
  };

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
      rateLimited: 0,
      attacksDetected: { total: 0, blocked: 0 },
      attackWaves: {
        total: 0,
        blocked: 0,
      },
    };
    this.userAgents = {
      breakdown: {},
    };
    this.ipAddresses = {
      breakdown: {},
    };
    this.startedAt = Date.now();
    this.sqlTokenizationFailures = 0;
  }

  getStats(): {
    operations: Record<string, OperationStatsWithoutTimings>;
    startedAt: number;
    sqlTokenizationFailures: number;
    requests: {
      total: number;
      aborted: number;
      rateLimited: number;
      attacksDetected: {
        total: number;
        blocked: number;
      };
      attackWaves: {
        total: number;
        blocked: number;
      };
    };
    userAgents: {
      breakdown: Record<string, number>;
    };
    ipAddresses: {
      breakdown: Record<string, number>;
    };
  } {
    const operations: Record<string, OperationStatsWithoutTimings> = {};
    for (const operation in this.operations) {
      const operationStats = this.operations[operation];
      operations[operation] = {
        kind: operationStats.kind,
        total: operationStats.total,
        attacksDetected: {
          total: operationStats.attacksDetected.total,
          blocked: operationStats.attacksDetected.blocked,
        },
        interceptorThrewError: operationStats.interceptorThrewError,
        withoutContext: operationStats.withoutContext,
        compressedTimings: operationStats.compressedTimings,
      };
    }

    return {
      operations: operations,
      startedAt: this.startedAt,
      sqlTokenizationFailures: this.sqlTokenizationFailures,
      requests: this.requests,
      userAgents: this.userAgents,
      ipAddresses: this.ipAddresses,
    };
  }

  private ensureOperationStats(operation: string, kind: OperationKind) {
    if (!this.operations[operation]) {
      this.operations[operation] = {
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

  private compressPerfSamples(operation: string) {
    if (operation.length === 0) {
      return;
    }

    /* c8 ignore start */
    if (!this.operations[operation]) {
      return;
    }

    if (this.operations[operation].durations.length === 0) {
      return;
    }
    /* c8 ignore stop */

    const timings = this.operations[operation].durations;
    const averageInMS =
      timings.reduce((acc, curr) => acc + curr, 0) / timings.length;

    const [p50, p75, p90, p95, p99] = percentiles(
      [50, 75, 90, 95, 99],
      timings
    );

    this.operations[operation].compressedTimings.push({
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
      this.operations[operation].compressedTimings.length >
      this.maxCompressedStatsInMemory
    ) {
      this.operations[operation].compressedTimings.shift();
    }

    this.operations[operation].durations = [];
  }

  interceptorThrewError(operation: string, kind: OperationKind) {
    if (operation.length === 0) {
      return;
    }

    this.ensureOperationStats(operation, kind);
    this.operations[operation].total += 1;
    this.operations[operation].interceptorThrewError += 1;
  }

  onDetectedAttack({ blocked }: { blocked: boolean }) {
    this.requests.attacksDetected.total += 1;
    if (blocked) {
      this.requests.attacksDetected.blocked += 1;
    }
  }

  onIPAddressMatches(matches: IPListKey[]) {
    matches.forEach((key) => {
      if (!this.ipAddresses.breakdown[key]) {
        this.ipAddresses.breakdown[key] = 0;
      }

      this.ipAddresses.breakdown[key] += 1;
    });
  }

  onUserAgentMatches(matches: UserAgentBotKey[]) {
    matches.forEach((key) => {
      if (!this.userAgents.breakdown[key]) {
        this.userAgents.breakdown[key] = 0;
      }

      this.userAgents.breakdown[key] += 1;
    });
  }

  onAbortedRequest() {
    this.requests.aborted += 1;
  }

  onRequest() {
    this.requests.total += 1;
  }

  onRateLimitedRequest() {
    this.requests.rateLimited += 1;
  }

  onAttackWaveDetected() {
    this.requests.attackWaves.total += 1;
  }

  onInspectedCall({
    operation,
    kind,
    blocked,
    attackDetected,
    durationInMs,
    withoutContext,
  }: {
    operation: string;
    kind: OperationKind;
    durationInMs: number;
    attackDetected: boolean;
    blocked: boolean;
    withoutContext: boolean;
  }) {
    if (operation.length === 0) {
      return;
    }

    this.ensureOperationStats(operation, kind);

    this.operations[operation].total += 1;

    if (withoutContext) {
      this.operations[operation].withoutContext += 1;
      return;
    }

    if (
      this.operations[operation].durations.length >= this.maxPerfSamplesInMemory
    ) {
      this.compressPerfSamples(operation);
    }

    this.operations[operation].durations.push(durationInMs);

    if (attackDetected) {
      this.operations[operation].attacksDetected.total += 1;
      if (blocked) {
        this.operations[operation].attacksDetected.blocked += 1;
      }
    }
  }

  forceCompress() {
    for (const kind in this.operations) {
      this.compressPerfSamples(kind as OperationKind);
    }
  }

  onSqlTokenizationFailure() {
    this.sqlTokenizationFailures += 1;
  }
}
