import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { Mistral as MistralSink } from "./Mistral";

t.test(
  "it works",
  {
    skip: !process.env.MISTRAL_API_KEY ? "MISTRAL_API_KEY not set" : undefined,
  },
  async (t) => {
    const agent = createTestAgent();
    agent.start([new MistralSink()]);

    const { Mistral } = require("@mistralai/mistralai");

    const mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });

    const result = await mistral.chat.complete({
      model: "mistral-medium",
      messages: [
        {
          content:
            "What is the capital of France? Answer with just the city name, no punctuation.",
          role: "user",
        },
      ],
    });

    t.same(result.choices[0].message.content, "Paris");
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "mistral",
        calls: 1,
        model: result.model,
        tokens: {
          input: 21,
          output: 2,
          total: 23,
        },
      },
    ]);
  }
);
