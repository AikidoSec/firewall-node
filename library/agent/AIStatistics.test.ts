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
  });

  stats.onAICall({
    provider: "openai",
    model: "gpt-4",
    inputTokens: 200,
    outputTokens: 75,
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
    });

    stats.onAICall({
      provider: "openai",
      model: "gpt-3.5-turbo",
      inputTokens: 80,
      outputTokens: 40,
    });

    stats.onAICall({
      provider: "anthropic",
      model: "claude-3",
      inputTokens: 120,
      outputTokens: 60,
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
  });

  stats.onAICall({
    provider: "anthropic",
    model: "claude-3",
    inputTokens: 120,
    outputTokens: 60,
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
  });

  t.same(true, stats.isEmpty());
});
