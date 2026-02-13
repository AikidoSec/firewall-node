import * as t from "tap";
import { AIStatistics } from "./AIStatistics";

t.test("it initializes with empty state", async () => {
  const stats = new AIStatistics();

  t.same(stats.getStats(), []);
  t.equal(stats.isEmpty(), true);
});

t.test("it tracks basic AI calls", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 50,
    route: undefined,
  });

  const result = stats.getStats();
  t.equal(result.length, 1);
  t.same(result[0], {
    provider: "openai",
    model: "gpt-4",
    calls: 1,
    tokens: {
      input: 100,
      output: 50,
      total: 150,
    },
    routes: [],
  });

  t.equal(stats.isEmpty(), false);
});

t.test("it tracks multiple calls to the same provider/model", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 50,
    route: undefined,
  });

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 200,
    outputTokens: 75,
    route: undefined,
  });

  const result = stats.getStats();
  t.same(result.length, 1);
  t.same(result[0], {
    provider: "openai",
    model: "gpt-4",
    calls: 2,
    tokens: {
      input: 300,
      output: 125,
      total: 425,
    },
    routes: [],
  });
});

t.test(
  "it tracks different provider/model combinations separately",
  async () => {
    const stats = new AIStatistics();

    stats.onAICall({
      provider: "openai",
      model: "gpt-4",
      inputTokens: 100,
      outputTokens: 50,
      route: undefined,
    });

    stats.onAICall({
      provider: "openai",
      model: "gpt-3.5-turbo",
      inputTokens: 80,
      outputTokens: 40,
      route: undefined,
    });

    stats.onAICall({
      provider: "anthropic",
      model: "claude-3",
      inputTokens: 120,
      outputTokens: 60,
      route: undefined,
    });

    const result = stats.getStats();
    t.equal(result.length, 3);

    // Sort by provider:model for consistent testing
    result.sort((a, b) =>
      `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`)
    );

    t.same(result[0], {
      provider: "anthropic",
      model: "claude-3",
      calls: 1,
      tokens: {
        input: 120,
        output: 60,
        total: 180,
      },
      routes: [],
    });

    t.same(result[1], {
      provider: "openai",
      model: "gpt-3.5-turbo",
      calls: 1,
      tokens: {
        input: 80,
        output: 40,
        total: 120,
      },
      routes: [],
    });

    t.same(result[2], {
      provider: "openai",
      model: "gpt-4",
      calls: 1,
      tokens: {
        input: 100,
        output: 50,
        total: 150,
      },
      routes: [],
    });
  }
);

t.test("it resets all statistics", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 50,
    route: undefined,
  });

  stats.onAICall({
    provider: "anthropic",
    model: "claude-3",
    inputTokens: 120,
    outputTokens: 60,
    route: undefined,
  });

  t.equal(stats.isEmpty(), false);
  t.equal(stats.getStats().length, 2);

  stats.reset();

  t.equal(stats.isEmpty(), true);
  t.same(stats.getStats(), []);
});

t.test("it handles zero token inputs", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 0,
    outputTokens: 0,
    route: undefined,
  });

  const result = stats.getStats();
  t.equal(result.length, 1);
  t.same(result[0].tokens, {
    input: 0,
    output: 0,
    total: 0,
  });
});

t.test("called with empty provider", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 50,
    route: undefined,
  });

  t.same(true, stats.isEmpty());
});

t.test("called with empty model", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "",
    inputTokens: 100,
    outputTokens: 50,
    route: undefined,
  });

  t.same(true, stats.isEmpty());
});

t.test("it tracks route-specific statistics", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "/api/chat",
      method: "POST",
    },
    inputTokens: 100,
    outputTokens: 50,
  });

  const result = stats.getStats();
  t.equal(result.length, 1);
  t.same(result[0], {
    provider: "openai",
    model: "gpt-4",
    calls: 1,
    tokens: {
      input: 100,
      output: 50,
      total: 150,
    },
    routes: [
      {
        path: "/api/chat",
        method: "POST",
        calls: 1,
        tokens: {
          input: 100,
          output: 50,
          total: 150,
        },
      },
    ],
  });
});

t.test(
  "it tracks multiple route calls for the same provider/model",
  async () => {
    const stats = new AIStatistics();

    // First call to /api/chat
    stats.onAICall({
      provider: "openai",
      model: "gpt-4",
      route: {
        path: "/api/chat",
        method: "POST",
      },
      inputTokens: 100,
      outputTokens: 50,
    });

    // Second call to /api/chat
    stats.onAICall({
      provider: "openai",
      model: "gpt-4",
      route: {
        path: "/api/chat",
        method: "POST",
      },
      inputTokens: 120,
      outputTokens: 60,
    });

    // Call to different route
    stats.onAICall({
      provider: "openai",
      model: "gpt-4",
      route: {
        path: "/api/summary",
        method: "GET",
      },
      inputTokens: 80,
      outputTokens: 40,
    });

    const result = stats.getStats();
    t.equal(result.length, 1);
    t.same(result[0].calls, 3);
    t.same(result[0].tokens.total, 450);
    t.same(result[0].routes.length, 2);

    t.same(result[0].routes[0], {
      path: "/api/chat",
      method: "POST",
      calls: 2,
      tokens: {
        input: 220,
        output: 110,
        total: 330,
      },
    });

    t.same(result[0].routes[1], {
      path: "/api/summary",
      method: "GET",
      calls: 1,
      tokens: {
        input: 80,
        output: 40,
        total: 120,
      },
    });
  }
);

t.test("it mixes calls with and without routes", async () => {
  const stats = new AIStatistics();

  // Call without route
  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 50,
    route: undefined,
  });

  // Call with route
  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "/api/chat",
      method: "POST",
    },
    inputTokens: 120,
    outputTokens: 60,
  });

  const result = stats.getStats();
  t.same(result.length, 1);
  t.same(result[0].calls, 2);
  t.same(result[0].tokens.total, 330);
  t.same(result[0].routes.length, 1);

  t.same(result[0].routes[0], {
    path: "/api/chat",
    method: "POST",
    calls: 1,
    tokens: {
      input: 120,
      output: 60,
      total: 180,
    },
  });
});

t.test("it respects LRU limit for routes", async () => {
  const maxRoutes = 2;
  const stats = new AIStatistics(maxRoutes);

  // Add three different routes to exceed the limit
  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "/api/route1",
      method: "GET",
    },
    inputTokens: 100,
    outputTokens: 50,
  });

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "/api/route2",
      method: "GET",
    },
    inputTokens: 100,
    outputTokens: 50,
  });

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "/api/route3",
      method: "GET",
    },
    inputTokens: 100,
    outputTokens: 50,
  });

  const result = stats.getStats();
  t.equal(result.length, 1);
  // All calls should be tracked in the provider stats
  t.same(result[0].calls, 3);
  t.same(result[0].tokens.total, 450);

  // But only the most recent routes should be kept (LRU eviction)
  t.same(result[0].routes.length, 2);

  // The first route should have been evicted, keeping route2 and route3
  const routePaths = result[0].routes.map((r) => r.path);
  t.notOk(routePaths.includes("/api/route1"));
  t.ok(routePaths.includes("/api/route2"));
  t.ok(routePaths.includes("/api/route3"));
});

t.test("called with empty path", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "",
      method: "POST",
    },
    inputTokens: 100,
    outputTokens: 50,
  });

  const result = stats.getStats();
  t.equal(result.length, 1);
  t.same(result[0].routes.length, 0);
});

t.test("called with empty method", async () => {
  const stats = new AIStatistics();

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    route: {
      path: "/api/chat",
      method: "",
    },
    inputTokens: 100,
    outputTokens: 50,
  });

  const result = stats.getStats();
  t.equal(result.length, 1);
  t.same(result[0].routes.length, 0);
});
