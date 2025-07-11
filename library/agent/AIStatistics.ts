type AIProviderStats = {
  provider: string;
  model: string;
  calls: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  callDetails: AICallDetail[]
};
type AICallDetail = {
  timeStartMS: number;
  timeEndMS: number;
  identifier: string;
};

export class AIStatistics {
  private calls: Map<string, AIProviderStats> = new Map();

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
        callDetails: [],
        calls: 0,
        tokens: {
          input: 0,
          output: 0,
          total: 0,
        }
      });
    }

    return this.calls.get(key)!;
  }

  onAICall({
    provider,
    model,
    inputTokens,
    outputTokens,
    callDetails
  }: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    callDetails?: AICallDetail;
  }) {
    if (!provider || !model) {
      return;
    }

    const providerStats = this.ensureProviderStats(provider, model);
    providerStats.calls += 1;
    providerStats.tokens.input += inputTokens;
    providerStats.tokens.output += outputTokens;
    providerStats.tokens.total += inputTokens + outputTokens;
    if (callDetails) {
      providerStats.callDetails.push(callDetails)
    }
  }

  getStats() {
    return Array.from(this.calls.values()).map((stats) => {
      return {
        provider: stats.provider,
        model: stats.model,
        calls: stats.calls,
        tokens: {
          input: stats.tokens.input,
          output: stats.tokens.output,
          total: stats.tokens.total,
        },
        callDetails: stats.callDetails,
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
