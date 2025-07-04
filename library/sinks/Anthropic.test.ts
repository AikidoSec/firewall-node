import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { Anthropic as AnthropicSink } from "./Anthropic";

t.test(
  "it works",
  {
    skip: !process.env.ANTHROPIC_API_KEY
      ? "ANTHROPIC_API_KEY not set"
      : undefined,
  },
  async (t) => {
    const agent = createTestAgent();
    agent.start([new AnthropicSink()]);

    const Anthropic = require("@anthropic-ai/sdk");

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await client.messages.create({
      // eslint-disable-next-line camelcase
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            "What is the capital of France? Answer with just the city name, no punctuation.",
        },
      ],
      model: "claude-3-haiku-20240307",
    });

    t.same(result.content[0].text, "Paris");
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "anthropic",
        calls: 1,
        model: result.model,
        tokens: {
          input: 25,
          output: 4,
          total: 29,
        },
      },
    ]);
  }
);
