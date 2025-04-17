import { percentiles } from "../helpers/percentiles";

type SinkCompressedTimings = {
  averageInMS: number;
  percentiles: Record<string, number>;
  compressedAt: number;
};

type SinkStats = {
  withoutContext: number;
  total: number;
  // array where we accumulate durations for each sink-request (e.g. mysql.query)
  durations: number[];
  // array where we put compressed blocks of stats
  compressedTimings: SinkCompressedTimings[];
  interceptorThrewError: number;
  attacksDetected: {
    total: number;
    blocked: number;
  };
};

type SinkStatsWithoutTimings = Omit<SinkStats, "durations">;
type UserAgentBotKey = string;
type IPListKey = string;

type UserAgentStats = {
  total: number;
  blocked: number;
  breakdown: Record<UserAgentBotKey, { total: number; blocked: number }>;
};

type IPAddressStats = {
  total: number;
  blocked: number;
  breakdown: Record<IPListKey, { total: number; blocked: number }>;
};

export class InspectionStatistics {
  private startedAt = Date.now();
  private stats: Record<string, SinkStats> = {};
  private readonly maxPerfSamplesInMemory: number;
  private readonly maxCompressedStatsInMemory: number;
  private requests: {
    total: number;
    aborted: number;
    attacksDetected: {
      total: number;
      blocked: number;
    };
  } = {
    total: 0,
    aborted: 0,
    attacksDetected: { total: 0, blocked: 0 },
  };
  private userAgents: UserAgentStats = {
    total: 0,
    blocked: 0,
    breakdown: {},
  };
  private ipAddresses: IPAddressStats = {
    total: 0,
    blocked: 0,
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
    return Object.values(this.stats).some(
      (sinkStats) => sinkStats.compressedTimings.length > 0
    );
  }

  isEmpty() {
    return (
      this.requests.total === 0 &&
      Object.keys(this.stats).length === 0 &&
      this.requests.attacksDetected.total === 0
    );
  }

  reset() {
    this.stats = {};
    this.requests = {
      total: 0,
      aborted: 0,
      attacksDetected: { total: 0, blocked: 0 },
    };
    this.userAgents = {
      total: 0,
      blocked: 0,
      breakdown: {},
    };
    this.ipAddresses = {
      total: 0,
      blocked: 0,
      breakdown: {},
    };
    this.startedAt = Date.now();
  }

  getStats(): {
    sinks: Record<string, SinkStatsWithoutTimings>;
    startedAt: number;
    requests: {
      total: number;
      aborted: number;
      attacksDetected: {
        total: number;
        blocked: number;
      };
    };
    userAgents: {
      total: number;
      blocked: number;
      breakdown: Record<string, { total: number; blocked: number }>;
    };
    ipAddresses: {
      total: number;
      blocked: number;
      breakdown: Record<string, { total: number; blocked: number }>;
    };
  } {
    const sinks: Record<string, SinkStatsWithoutTimings> = {};
    for (const sink in this.stats) {
      const sinkStats = this.stats[sink];
      sinks[sink] = {
        total: sinkStats.total,
        attacksDetected: {
          total: sinkStats.attacksDetected.total,
          blocked: sinkStats.attacksDetected.blocked,
        },
        interceptorThrewError: sinkStats.interceptorThrewError,
        withoutContext: sinkStats.withoutContext,
        compressedTimings: sinkStats.compressedTimings,
      };
    }

    return {
      sinks: sinks,
      startedAt: this.startedAt,
      requests: this.requests,
      userAgents: this.userAgents,
      ipAddresses: this.ipAddresses,
    };
  }

  private ensureSinkStats(sink: string) {
    if (!this.stats[sink]) {
      this.stats[sink] = {
        withoutContext: 0,
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

  private compressPerfSamples(sink: string) {
    /* c8 ignore start */
    if (!this.stats[sink]) {
      return;
    }

    if (this.stats[sink].durations.length === 0) {
      return;
    }
    /* c8 ignore stop */

    const timings = this.stats[sink].durations;
    const averageInMS =
      timings.reduce((acc, curr) => acc + curr, 0) / timings.length;

    const [p50, p75, p90, p95, p99] = percentiles(
      [50, 75, 90, 95, 99],
      timings
    );

    this.stats[sink].compressedTimings.push({
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
      this.stats[sink].compressedTimings.length >
      this.maxCompressedStatsInMemory
    ) {
      this.stats[sink].compressedTimings.shift();
    }

    this.stats[sink].durations = [];
  }

  interceptorThrewError(sink: string) {
    this.ensureSinkStats(sink);
    this.stats[sink].total += 1;
    this.stats[sink].interceptorThrewError += 1;
  }

  onDetectedAttack({ blocked }: { blocked: boolean }) {
    this.requests.attacksDetected.total += 1;
    if (blocked) {
      this.requests.attacksDetected.blocked += 1;
    }
  }

  onIPAddressMatches(matches: { key: IPListKey; monitor: boolean }[]) {
    if (matches.length > 0) {
      this.ipAddresses.total += 1;
    }

    const blockingMatch = matches.find((match) => !match.monitor);
    if (blockingMatch) {
      this.ipAddresses.blocked += 1;
    }

    matches.forEach((match) => {
      if (!this.ipAddresses.breakdown[match.key]) {
        this.ipAddresses.breakdown[match.key] = { total: 0, blocked: 0 };
      }

      this.ipAddresses.breakdown[match.key].total += 1;

      if (!match.monitor) {
        this.ipAddresses.breakdown[match.key].blocked += 1;
      }
    });
  }

  onUserAgentMatches(matches: { key: UserAgentBotKey; monitor: boolean }[]) {
    if (matches.length > 0) {
      this.userAgents.total += 1;
    }

    const blockingMatch = matches.find((match) => !match.monitor);
    if (blockingMatch) {
      this.userAgents.blocked += 1;
    }

    matches.forEach((match) => {
      if (!this.userAgents.breakdown[match.key]) {
        this.userAgents.breakdown[match.key] = { total: 0, blocked: 0 };
      }

      this.userAgents.breakdown[match.key].total += 1;

      if (!match.monitor) {
        this.userAgents.breakdown[match.key].blocked += 1;
      }
    });
  }

  onAbortedRequest() {
    this.requests.aborted += 1;
  }

  onRequest() {
    this.requests.total += 1;
  }

  onInspectedCall({
    sink,
    blocked,
    attackDetected,
    durationInMs,
    withoutContext,
  }: {
    sink: string;
    durationInMs: number;
    attackDetected: boolean;
    blocked: boolean;
    withoutContext: boolean;
  }) {
    this.ensureSinkStats(sink);

    this.stats[sink].total += 1;

    if (withoutContext) {
      this.stats[sink].withoutContext += 1;
      return;
    }

    if (this.stats[sink].durations.length >= this.maxPerfSamplesInMemory) {
      this.compressPerfSamples(sink);
    }

    this.stats[sink].durations.push(durationInMs);

    if (attackDetected) {
      this.stats[sink].attacksDetected.total += 1;
      if (blocked) {
        this.stats[sink].attacksDetected.blocked += 1;
      }
    }
  }

  forceCompress() {
    for (const sink in this.stats) {
      this.compressPerfSamples(sink);
    }
  }
}
