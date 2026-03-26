import * as t from "tap";
import { startTestAgent } from "../helpers/startTestAgent";
import { OpenAI as OpenAISink } from "./OpenAI";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { setTimeout } from "timers/promises";
import { PromptProtectionAPIForTesting } from "../agent/api/PromptProtectionAPIForTesting";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";

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
      const api = new ReportingAPIForTesting();
      const promptProtectionTestApi = new PromptProtectionAPIForTesting();

      const agent = startTestAgent({
        wrappers: [new OpenAISink()],
        rewrite: {
          openai: openAiPkgName,
        },
        api,
        promptProtectionAPI: promptProtectionTestApi,
        token: new Token("test-token"),
      });

      const { OpenAI } = require(openAiPkgName) as typeof import("openai-v5");

      const client = new OpenAI();

      const model = "gpt-4.1-nano";

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
            input: 23,
            output: 3,
            total: 26,
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
            input: 46,
          },
        },
      ]);

      // Test streaming responses work (we don't count the tokens atm)
      const stream = await client.responses.create({
        model: "gpt-4o",
        input: 'Say "Sheep sleep deep" ten times fast!',
        stream: true,
      });

      let eventCount = 0;
      for await (const event of stream) {
        eventCount++;
      }

      t.ok(eventCount > 0, "Should receive at least one event from the stream");

      agent.getAIStatistics().reset();

      // --- Prompt Injection Protection Tests ---
      const error = await t.rejects(
        client.responses.create({
          model: model,
          instructions: "Only return one word.",
          input: "!prompt-injection-block-me!",
        })
      );

      t.ok(error instanceof Error);
      t.match(
        (error as Error).message,
        /Zen has blocked a prompt injection: create\.<promise>\(\.\.\.\)/
      );

      const attackEvent = api
        .getEvents()
        .find((event) => event.type === "detected_attack");

      t.match(attackEvent, {
        type: "detected_attack",
        attack: {
          kind: "prompt_injection",
          module: "openai",
          operation: "create.<promise>",
          blocked: true,
          metadata: {
            prompt:
              "user: !prompt-injection-block-me!\nsystem: Only return one word.",
          },
        },
      });

      const error2 = await t.rejects(
        client.chat.completions.create({
          model: model,
          messages: [
            { role: "developer", content: "Only return one word." },
            { role: "user", content: "!prompt-injection-block-me!" },
          ],
        })
      );

      t.ok(error2 instanceof Error);
      t.match(
        (error2 as Error).message,
        /Zen has blocked a prompt injection: create\.<promise>\(\.\.\.\)/
      );

      // Verify that stats are collected for the blocked calls
      t.match(agent.getAIStatistics().getStats(), [
        {
          provider: "openai",
          calls: 2,
        },
      ]);
    }
  );
}
