import * as t from "tap";
import { Mistral as MistralSink } from "./Mistral";
import { startTestAgent } from "../helpers/startTestAgent";

export function createMistralTests(pkgName: string) {
  t.test(
    "it works",
    {
      skip: !process.env.MISTRAL_API_KEY
        ? "MISTRAL_API_KEY not set"
        : undefined,
    },
    async (t) => {
      const agent = startTestAgent({
        wrappers: [new MistralSink()],
        rewrite: {
          "@mistralai/mistralai": pkgName,
        },
      });

      const { Mistral } = require(pkgName) as typeof import("mistralai-v2");

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
}
