import * as t from "tap";
import { once } from "events";
import { randomBytes } from "crypto";
import { createServer, type IncomingMessage } from "http";
import type { AddressInfo } from "net";
import { setTimeout } from "timers/promises";
import { gzipSync } from "zlib";
import { startTestAgent } from "../helpers/startTestAgent";
import { AIProviderTraffic } from "./AIProviderTraffic";
import { isAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";
import { Fetch } from "./Fetch";
import { HTTPRequest } from "./HTTPRequest";
import { OpenAI } from "./OpenAI";

process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE = "true";

// Random text, so that the body is split into multiple chunks, also when gzipped
const longText = randomBytes(150_000).toString("hex");

const chatCompletion = JSON.stringify({
  id: "chatcmpl-1",
  object: "chat.completion",
  model: "gpt-5-mini-2025-08-07",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: longText,
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
  usage: {
    prompt_tokens: 2000,
    completion_tokens: 10,
    prompt_tokens_details: { cached_tokens: 1024, cache_write_tokens: 512 },
  },
});

const anthropicMessage = JSON.stringify({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-4-5-20250929",
  content: [
    { type: "text", text: longText },
    { type: "server_tool_use", id: "s1", name: "web_search", input: {} },
  ],
  usage: {
    input_tokens: 12,
    output_tokens: 34,
    cache_read_input_tokens: 1000,
    cache_creation_input_tokens: 200,
  },
});

t.test(
  "it records AI calls made with fetch and http.request without changing the response",
  {
    skip: isAINetworkCaptureActive()
      ? undefined
      : "Requires undici 7.11+ bundled with Node.js",
  },
  async (t) => {
    const agent = startTestAgent({
      wrappers: [
        new Fetch(),
        new HTTPRequest(),
        new OpenAI(),
        new AIProviderTraffic(),
      ],
      rewrite: { openai: "openai-v5" },
    });

    const server = createServer((req, res) => {
      const body = req.url?.startsWith("/v1/messages")
        ? anthropicMessage
        : chatCompletion;

      if (req.headers["accept-encoding"]?.includes("gzip")) {
        res.writeHead(200, {
          "content-type": "application/json",
          "content-encoding": "gzip",
        });
        res.end(gzipSync(body));
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(body);
    });
    server.listen(0);
    await once(server, "listening");
    t.teardown(() => server.close());

    const baseURL = `http://localhost:${(server.address() as AddressInfo).port}`;

    const response = await fetch(`${baseURL}/v1/chat/completions?key=secret`, {
      method: "POST",
      body: "{}",
    });
    t.equal(await response.text(), chatCompletion);

    const { request } = require("http") as typeof import("http");
    const req = request(`${baseURL}/v1/messages`, { method: "POST" });
    req.end("{}");
    const [res] = (await once(req, "response")) as [IncomingMessage];
    // Apps can start reading the body later
    await setTimeout(50);
    const chunks: Buffer[] = [];
    for await (const chunk of res) {
      chunks.push(chunk);
    }
    t.equal(Buffer.concat(chunks).toString(), anthropicMessage);

    const { OpenAI: OpenAIClient } =
      require("openai-v5") as typeof import("openai-v5");
    const client = new OpenAIClient({
      apiKey: "test",
      baseURL: `${baseURL}/v1`,
    });
    await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "Hi" }],
    });

    await setTimeout(100);

    t.same(agent.getAIStatistics().getStats(), [
      {
        provider: "openai_compatible",
        model: "gpt-5-mini-2025-08-07",
        calls: 2,
        tokens: {
          input: 4000,
          output: 20,
          total: 4020,
          cacheRead: 2048,
          cacheWrite: 1024,
        },
      },
      {
        provider: "anthropic_compatible",
        model: "claude-sonnet-4-5-20250929",
        calls: 1,
        tokens: {
          input: 12,
          output: 34,
          total: 46,
          cacheRead: 1000,
          cacheWrite: 200,
        },
      },
    ]);
    t.same(agent.getAIStatistics().getToolCallStats(), [
      { name: "get_weather", calls: 2, blocked: 0 },
      { name: "web_search", calls: 1, blocked: 0 },
    ]);
  }
);
