import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { OpenAI as OpenAISink } from "./OpenAI";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { setTimeout } from "timers/promises";

export function createOpenAITests(openAiPkgName: string) {
  t.test(
    "It works",
    {
      skip:
        !process.env.OPENAI_API_KEY || getMajorNodeVersion() < 22
          ? "OpenAI API key not set or Node version < 22"
          : undefined,
    },
    async (t) => {
      const agent = startTestAgent({
        wrappers: [new OpenAISink()],
        rewrite: {
          openai: openAiPkgName,
        },
      });

      const { OpenAI } = require(openAiPkgName) as typeof import("openai-v5");

      const client = new OpenAI();

      const model = "gpt-5.4-nano";

      const response = await client.responses.create({
        model: model,
        instructions: "Only return one word.",
        input: "What is the capital of Belgium?",
      });

      t.same(response.output_text, "Brussels");

      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "openai",
          calls: 1,
          tokens: {
            input: 22,
            output: 6,
            total: 28,
          },
        },
      ]);

      t.match(agent.getAIStatistics().getStats()[0].model, model); // Model name starts with the used model but may include additional information

      await setTimeout(100);

      const completion = await client.chat.completions.create({
        model: model,
        messages: [
          { role: "developer", content: "Only return one word." },
          { role: "user", content: "What is the capital of Norway?" },
        ],
      });

      t.same(completion.choices[0].message.content, "Oslo");

      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "openai",
          calls: 2,
          tokens: {
            input: 44,
          },
        },
      ]);

      // Test streaming responses work (we don't count the tokens atm)
      const stream = await client.responses.create({
        model: "gpt-5.4-mini",
        input: 'Say "Sheep sleep deep" ten times fast!',
        stream: true,
      });

      let eventCount = 0;
      for await (const event of stream) {
        eventCount++;
      }

      t.ok(eventCount > 0, "Should receive at least one event from the stream");
    }
  );
}
