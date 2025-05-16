type SinkStats = {
  withoutContext: number;
  total: number;
  interceptorThrewError: number;
  attacksDetected: {
    total: number;
    blocked: number;
  };
};

type SinkStatsWithoutTimings = Omit<SinkStats, "durations">;

export class InspectionStatistics {
  private startedAt = Date.now();
  private stats: Record<string, SinkStats> = {};
  private requests: {
    total: number;
    aborted: number;
    attacksDetected: {
      total: number;
      blocked: number;
    };
  } = { total: 0, aborted: 0, attacksDetected: { total: 0, blocked: 0 } };

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
      };
    }

    return {
      sinks: sinks,
      startedAt: this.startedAt,
      requests: this.requests,
    };
  }

  private ensureSinkStats(sink: string) {
    if (!this.stats[sink]) {
      this.stats[sink] = {
        withoutContext: 0,
        total: 0,
        interceptorThrewError: 0,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      };
    }
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
    // Let's remove later
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    if (attackDetected) {
      this.stats[sink].attacksDetected.total += 1;
      if (blocked) {
        this.stats[sink].attacksDetected.blocked += 1;
      }
    }
  }
}
