import { LRUMap } from "../ratelimiting/LRUMap";

type AIRouteStats = {
  path: string;
  method: string;
  calls: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
};

type AIProviderStats = {
  provider: string;
  model: string;
  calls: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  routesLRU: LRUMap<string, AIRouteStats>;
};

export class AIStatistics {
  private calls: Map<string, AIProviderStats> = new Map();
  private maxRoutes: number;

  constructor(maxRoutes: number = 1000) {
    this.maxRoutes = maxRoutes;
  }

  private getProviderKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  private getRouteKey(path: string, method: string): string {
    return `${method}:${path}`;
  }

  private ensureProviderStats(
    provider: string,
    model: string
  ): AIProviderStats {
    const key = this.getProviderKey(provider, model);

    if (!this.calls.has(key)) {
      this.calls.set(key, {
        provider,
        model,
        calls: 0,
        tokens: {
          input: 0,
          output: 0,
          total: 0,
        },
        routesLRU: new LRUMap<string, AIRouteStats>(this.maxRoutes),
      });
    }

    return this.calls.get(key)!;
  }

  private ensureRouteStats(
    providerStats: AIProviderStats,
    path: string,
    method: string
  ): AIRouteStats {
    const routeKey = this.getRouteKey(path, method);

    let routeStats = providerStats.routesLRU.get(routeKey);

    if (!routeStats) {
      routeStats = {
        path,
        method,
        calls: 0,
        tokens: {
          input: 0,
          output: 0,
          total: 0,
        },
      };
      providerStats.routesLRU.set(routeKey, routeStats);
    }

    return routeStats;
  }

  onAICall({
    provider,
    model,
    route,
    inputTokens,
    outputTokens,
  }: {
    provider: string;
    model: string;
    route:
      | {
          path: string;
          method: string;
        }
      | undefined;
    inputTokens: number;
    outputTokens: number;
  }) {
    if (!provider || !model) {
      return;
    }

    const providerStats = this.ensureProviderStats(provider, model);
    providerStats.calls += 1;
    providerStats.tokens.input += inputTokens;
    providerStats.tokens.output += outputTokens;
    providerStats.tokens.total += inputTokens + outputTokens;

    if (route && route.path && route.method) {
      const routeStats = this.ensureRouteStats(
        providerStats,
        route.path,
        route.method
      );

      routeStats.calls += 1;
      routeStats.tokens.input += inputTokens;
      routeStats.tokens.output += outputTokens;
      routeStats.tokens.total += inputTokens + outputTokens;
    }
  }

  getStats() {
    return Array.from(this.calls.values()).map((stats) => {
      const routes = Array.from(stats.routesLRU.keys()).map(
        (key) => stats.routesLRU.get(key) as AIRouteStats
      );

      return {
        provider: stats.provider,
        model: stats.model,
        calls: stats.calls,
        tokens: {
          input: stats.tokens.input,
          output: stats.tokens.output,
          total: stats.tokens.total,
        },
        routes,
      };
    });
  }

  reset() {
    this.calls.clear();
  }

  isEmpty(): boolean {
    return this.calls.size === 0;
  }
}
