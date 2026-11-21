type AIProviderStats = {
  provider: string;
  model: string;
  calls: number;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
};

type AIToolCallStats = {
  name: string;
  calls: number;
  blocked: number;
};

export class AIStatistics {
  private calls: Map<string, AIProviderStats> = new Map();
  private toolCalls: Map<string, AIToolCallStats> = new Map();

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
      });
    }

    return this.calls.get(key)!;
  }

  onAICall({
    provider,
    model,
    inputTokens,
    outputTokens,
  }: {
    provider: string;
    model: string;
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
      };
    });
  }

  onAIToolCall({ name, blocked }: { name: string; blocked: boolean }) {
    if (!name) {
      return;
    }

    if (!this.toolCalls.has(name)) {
      this.toolCalls.set(name, { name, calls: 0, blocked: 0 });
    }

    const toolStats = this.toolCalls.get(name)!;
    toolStats.calls += 1;
    if (blocked) {
      toolStats.blocked += 1;
    }
  }

  getToolCallStats() {
    return Array.from(this.toolCalls.values());
  }

  reset() {
    this.calls.clear();
    this.toolCalls.clear();
  }

  isEmpty(): boolean {
    return this.calls.size === 0 && this.toolCalls.size === 0;
  }
}
