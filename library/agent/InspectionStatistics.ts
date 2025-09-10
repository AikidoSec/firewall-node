import { OperationKind } from "./api/Event";

type OperationStats = {
  kind: OperationKind;
  withoutContext: number;
  total: number;
  interceptorThrewError: number;
  attacksDetected: {
    total: number;
    blocked: number;
  };
};

type OperationStatsWithoutTimings = OperationStats;
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
        interceptorThrewError: 0,
        attacksDetected: {
          total: 0,
          blocked: 0,
        },
      };
    }
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
    withoutContext,
  }: {
    operation: string;
    kind: OperationKind;
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

    if (attackDetected) {
      this.operations[operation].attacksDetected.total += 1;
      if (blocked) {
        this.operations[operation].attacksDetected.blocked += 1;
      }
    }
  }

  onSqlTokenizationFailure() {
    this.sqlTokenizationFailures += 1;
  }
}
