import * as t from "tap";
import { once } from "events";
import { randomBytes } from "crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { AddressInfo } from "net";
import { setTimeout } from "timers/promises";
import { gzipSync } from "zlib";
import { startTestAgent } from "../helpers/startTestAgent";
import { AIProviderTraffic } from "./AIProviderTraffic";
import { isAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";
import { AiSDK } from "./AiSDK";
import { Fetch } from "./Fetch";
import { HTTPRequest } from "./HTTPRequest";
import { OpenAI } from "./OpenAI";

process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE = "true";

const skip = isAINetworkCaptureActive()
  ? undefined
  : "Requires undici 7.11+ bundled with Node.js";

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

function data(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const chatCompletionStream = [
  data({
    model: "gpt-4o-2024-08-06",
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "call_1",
              function: { name: "get_weather", arguments: "" },
            },
          ],
        },
      },
    ],
  }),
  data({
    model: "gpt-4o-2024-08-06",
    choices: [
      {
        index: 0,
        delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] },
      },
    ],
  }),
  data({
    model: "gpt-4o-2024-08-06",
    choices: [],
    usage: { prompt_tokens: 50, completion_tokens: 20 },
  }),
  "data: [DONE]\n\n",
];

const anthropicStream = [
  {
    type: "message_start",
    message: {
      model: "claude-haiku-4-5",
      content: [],
      usage: {
        input_tokens: 25,
        output_tokens: 1,
        cache_read_input_tokens: 500,
      },
    },
  },
  {
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "tool_use",
      id: "t1",
      name: "search_docs",
      input: {},
    },
  },
  { type: "message_delta", delta: {}, usage: { output_tokens: 42 } },
  { type: "message_stop" },
].map((event) => `event: ${event.type}\n${data(event)}`);

const geminiStream = [
  data({
    candidates: [{ content: { role: "model", parts: [{ text: "Hello" }] } }],
    usageMetadata: { promptTokenCount: 5 },
    modelVersion: "gemini-2.5-flash",
  }),
  data({
    candidates: [
      {
        content: { role: "model", parts: [{ text: " world" }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 5,
      candidatesTokenCount: 2,
      totalTokenCount: 7,
    },
    modelVersion: "gemini-2.5-flash",
  }),
];

async function writeEventStream(res: ServerResponse, events: string[]) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const event of events) {
    res.write(event);
    await setTimeout(5);
  }
  res.end();
}

const server = createServer((req, res) => {
  switch (req.url?.split("?")[0]) {
    case "/stream/v1/chat/completions":
      writeEventStream(res, chatCompletionStream);
      return;
    case "/stream/v1/messages":
      writeEventStream(res, anthropicStream);
      return;
    case "/v1beta/models/gemini-2.5-flash:streamGenerateContent":
      writeEventStream(res, geminiStream);
      return;
  }

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

const agent = startTestAgent({
  wrappers: [
    new Fetch(),
    new HTTPRequest(),
    new OpenAI(),
    new AiSDK(),
    new AIProviderTraffic(),
  ],
  rewrite: { openai: "openai-v5", ai: "ai-v7" },
});

let baseURL = "";

t.before(async () => {
  server.listen(0);
  await once(server, "listening");
  baseURL = `http://localhost:${(server.address() as AddressInfo).port}`;
});

t.teardown(() => server.close());

t.beforeEach(() => agent.getAIStatistics().reset());

async function readHTTPResponse(path: string): Promise<string> {
  const { request } = require("http") as typeof import("http");
  const req = request(`${baseURL}${path}`, { method: "POST" });
  req.end("{}");
  const [res] = (await once(req, "response")) as [IncomingMessage];
  // Apps can start reading the body later
  await setTimeout(50);
  const chunks: Buffer[] = [];
  for await (const chunk of res) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString();
}

t.test(
  "it records AI calls made with fetch and http.request without changing the response",
  { skip },
  async (t) => {
    const response = await fetch(`${baseURL}/v1/chat/completions?key=secret`, {
      method: "POST",
      body: "{}",
    });
    t.equal(await response.text(), chatCompletion);

    t.equal(await readHTTPResponse("/v1/messages"), anthropicMessage);

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

t.test(
  "it records streamed AI calls while the app reads them chunk by chunk",
  { skip },
  async (t) => {
    const response = await fetch(`${baseURL}/stream/v1/chat/completions`, {
      method: "POST",
      body: "{}",
    });
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    for (
      let read = await reader.read();
      !read.done;
      read = await reader.read()
    ) {
      chunks.push(read.value);
    }
    t.equal(Buffer.concat(chunks).toString(), chatCompletionStream.join(""));

    t.equal(
      await readHTTPResponse("/stream/v1/messages"),
      anthropicStream.join("")
    );

    await setTimeout(100);

    t.same(agent.getAIStatistics().getStats(), [
      {
        provider: "openai_compatible",
        model: "gpt-4o-2024-08-06",
        calls: 1,
        tokens: {
          input: 50,
          output: 20,
          total: 70,
          cacheRead: 0,
          cacheWrite: 0,
        },
      },
      {
        provider: "anthropic_compatible",
        model: "claude-haiku-4-5",
        calls: 1,
        tokens: {
          input: 25,
          output: 42,
          total: 67,
          cacheRead: 500,
          cacheWrite: 0,
        },
      },
    ]);
    t.same(agent.getAIStatistics().getToolCallStats(), [
      { name: "get_weather", calls: 1, blocked: 0 },
      { name: "search_docs", calls: 1, blocked: 0 },
    ]);
  }
);

t.test(
  "it doesn't count AI SDK streamText calls twice",
  { skip },
  async (t) => {
    const { createGoogleGenerativeAI } =
      require("@ai-sdk/google-v3") as typeof import("@ai-sdk/google-v3");
    const { streamText } = require("ai-v7") as typeof import("ai-v7");

    const google = createGoogleGenerativeAI({
      apiKey: "test",
      baseURL: `${baseURL}/v1beta`,
    });
    const result = streamText({
      model: google("gemini-2.5-flash"),
      prompt: "Hi",
    });
    let text = "";
    for await (const chunk of result.textStream) {
      text += chunk;
    }
    t.equal(text, "Hello world");
    await result.usage;

    await setTimeout(100);

    t.same(agent.getAIStatistics().getStats(), [
      {
        provider: "gemini_compatible",
        model: "gemini-2.5-flash",
        calls: 1,
        tokens: { input: 5, output: 2, total: 7, cacheRead: 0, cacheWrite: 0 },
      },
    ]);
  }
);
