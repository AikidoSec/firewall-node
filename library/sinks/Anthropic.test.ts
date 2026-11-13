import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { Anthropic as AnthropicSink } from "./Anthropic";
import { Undici } from "./Undici";
import { isAIProviderTrafficCaptureEnabled } from "../ai-governance/isAIProviderTrafficCaptureEnabled";

t.test(
  "it works",
  {
    skip: !process.env.ANTHROPIC_API_KEY
      ? "ANTHROPIC_API_KEY not set"
      : undefined,
  },
  async (t) => {
    const agent = createTestAgent();
    // The Undici sink is needed when AIKIDO_FEATURE_AI_NETWORK_CAPTURE is enabled,
    agent.start([new AnthropicSink(), new Undici()]);

    const Anthropic = require("@anthropic-ai/sdk");

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });

    const result = await client.messages.create({
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            "What is the capital of France? Answer with just the city name, no punctuation.",
        },
      ],
      model: "claude-haiku-5-5",
    });

    t.same(result.content[0].text, "Paris");
    t.match(agent.getAIStatistics().getStats(), [
      {
        // When capturing from the network, the provider is the origin of the request
        provider: isAIProviderTrafficCaptureEnabled()
          ? new URL(
              process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"
            ).origin
          : "anthropic",
        calls: 1,
        model: result.model,
        tokens: {
          input: 31,
          output: 5,
          total: 36,
        },
      },
    ]);

    // We don't track the token usage of streaming calls yet.
    // Verify that we don't break user's code
    const stream = await client.messages.create({
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content:
            "What is the capital of France? Answer with just the city name, no punctuation.",
        },
      ],
      model: "claude-haiku-5-5",
      stream: true,
    });

    let eventCount = 0;
    for await (const messageStreamEvent of stream) {
      t.ok(messageStreamEvent.type, "Event should have a type");
      eventCount++;
    }

    t.ok(eventCount > 0, "Should receive at least one stream event");
  }
);
