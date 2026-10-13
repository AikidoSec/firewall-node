import * as t from "tap";
import { once } from "events";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { setTimeout } from "timers/promises";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { startTestAgent } from "../helpers/startTestAgent";
import { AIProviderTraffic } from "./AIProviderTraffic";
import { isAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";
import { OpenAI } from "./OpenAI";

const bundledUndiciVersion = process.versions.undici;

function setUndiciVersion(version: string | undefined) {
  Object.defineProperty(process.versions, "undici", {
    value: version,
    configurable: true,
  });
}

t.afterEach(() => {
  delete process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE;
  setUndiciVersion(bundledUndiciVersion);
});

t.test("it needs the flag and undici 7.11+", async (t) => {
  setUndiciVersion("7.11.0");
  t.equal(isAINetworkCaptureActive(), false);

  process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE = "true";
  t.equal(isAINetworkCaptureActive(), true);

  setUndiciVersion("7.10.0");
  t.equal(isAINetworkCaptureActive(), false);

  setUndiciVersion(undefined);
  t.equal(isAINetworkCaptureActive(), false);
});

t.test(
  "with an unsupported undici version, the SDK sinks record instead of the network capture",
  {
    skip: getMajorNodeVersion() < 22 ? "Node version < 22" : undefined,
  },
  async (t) => {
    process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE = "true";
    setUndiciVersion("7.10.0");

    const agent = startTestAgent({
      wrappers: [new OpenAI(), new AIProviderTraffic()],
      rewrite: { openai: "openai-v5" },
    });

    const server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "chatcmpl-1",
          object: "chat.completion",
          model: "gpt-5-mini-2025-08-07",
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
                    function: { name: "get_weather", arguments: "{}" },
                  },
                ],
              },
              finish_reason: "tool_calls",
            },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 1 },
        })
      );
    });
    server.listen(0);
    await once(server, "listening");
    t.teardown(() => server.close());

    const baseURL = `http://localhost:${(server.address() as AddressInfo).port}/v1`;

    await (
      await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        body: "{}",
      })
    ).text();

    const { OpenAI: OpenAIClient } =
      require("openai-v5") as typeof import("openai-v5");
    const client = new OpenAIClient({ apiKey: "test", baseURL });
    await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Hi" }],
    });

    await setTimeout(100);

    t.same(agent.getAIStatistics().getStats(), [
      {
        provider: "openai",
        model: "gpt-5-mini-2025-08-07",
        calls: 1,
        tokens: { input: 5, output: 1, total: 6, cacheRead: 0, cacheWrite: 0 },
      },
    ]);
    t.same(agent.getAIStatistics().getToolCallStats(), []);
  }
);
