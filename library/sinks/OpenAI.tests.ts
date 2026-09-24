import * as t from "tap";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { startTestAgent } from "../helpers/startTestAgent";
import { OpenAI as OpenAISink } from "./OpenAI";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { setTimeout } from "timers/promises";

export function createOpenAITests(openAiPkgName: string) {
  if (getMajorNodeVersion() < 22) {
    t.skip("Skipping OpenAI tests because Node version < 22", () => {});
    return;
  }

  const agent = startTestAgent({
    wrappers: [new OpenAISink()],
    rewrite: {
      openai: openAiPkgName,
    },
  });

  const { OpenAI, AzureOpenAI } = require(
    openAiPkgName
  ) as typeof import("openai-v7");

  t.test(
    "It works",
    {
      skip: !process.env.OPENAI_API_KEY ? "OpenAI API key not set" : undefined,
    },
    async (t) => {
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

  t.test(
    "It reports Azure OpenAI calls under the azure provider, not openai",
    async (t) => {
      const chatCompletion = {
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 0,
        model: "gpt-5-mini",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Hi" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
      };

      const server = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(chatCompletion));
      });

      await new Promise<void>((resolve) => server.listen(0, resolve));
      t.teardown(() => server.close());

      const baseURL = `http://localhost:${
        (server.address() as AddressInfo).port
      }/v1`;

      const openaiClient = new OpenAI({ apiKey: "test", baseURL });
      await openaiClient.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: "Hi" }],
      });

      const azureClient = new AzureOpenAI({
        apiKey: "test",
        apiVersion: "2024-02-01",
        baseURL,
      });
      await azureClient.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: "Hi" }],
      });

      await setTimeout(100);

      t.match(agent.getAIStatistics().getStats(), [
        { provider: "openai", model: "gpt-5-mini", calls: 1 },
        { provider: "azure", model: "gpt-5-mini", calls: 1 },
      ]);
    }
  );

  t.test(
    "It strips a blocked AI tool call from the response and records stats",
    async (t) => {
      agent.getConfig().setBlockedAIToolNames(["dangerous_tool"]);

      const chatCompletion = {
        id: "chatcmpl-tool-test",
        object: "chat.completion",
        created: 0,
        model: "gpt-5-mini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "dangerous_tool", arguments: "{}" },
                },
                {
                  id: "call_2",
                  type: "function",
                  function: { name: "safe_tool", arguments: "{}" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const server = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(chatCompletion));
      });

      await new Promise<void>((resolve) => server.listen(0, resolve));
      t.teardown(() => server.close());

      const baseURL = `http://localhost:${
        (server.address() as AddressInfo).port
      }/v1`;

      const client = new OpenAI({ apiKey: "test", baseURL });

      const completion = await client.chat.completions.create({
        model: "gpt-5-mini",
        messages: [{ role: "user", content: "Do something" }],
      });

      const remainingToolCalls = completion.choices[0].message.tool_calls ?? [];

      t.same(
        remainingToolCalls.map((call) =>
          call.type === "function" ? call.function.name : undefined
        ),
        ["safe_tool"]
      );

      t.match(agent.getAIStatistics().getToolCallStats(), [
        { name: "dangerous_tool", calls: 1, blocked: 1 },
        { name: "safe_tool", calls: 1, blocked: 0 },
      ]);
    }
  );
}
