import * as t from "tap";
import type { Test } from "tap";
import { createServer } from "http";
import type { AddressInfo } from "net";
import { Token } from "../agent/api/Token";
import { startTestAgent } from "../helpers/startTestAgent";
import { Undici } from "../sinks/Undici";
import { Fetch } from "../sinks/Fetch";
import { HTTPRequest } from "../sinks/HTTPRequest";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

const ENV_NAME = "AIKIDO_FEATURE_AI_NETWORK_CAPTURE";
const originalEnvValue = process.env[ENV_NAME];
const skip = getMajorNodeVersion() < 24 ? "Needs Node.js 24+" : undefined;

const openAIChat = JSON.stringify({
  id: "chatcmpl-1",
  object: "chat.completion",
  created: 1,
  model: "gpt-4o-mock",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hi there" },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    prompt_tokens_details: { cached_tokens: 4 },
  },
});

const openAIResponses = JSON.stringify({
  id: "resp_1",
  object: "response",
  created_at: 1,
  status: "completed",
  model: "gpt-5-mock",
  output: [
    {
      type: "message",
      id: "msg_1",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: "Hi there", annotations: [] }],
    },
  ],
  usage: {
    input_tokens: 12,
    output_tokens: 6,
    total_tokens: 18,
    input_tokens_details: { cached_tokens: 3 },
    output_tokens_details: { reasoning_tokens: 0 },
  },
});

const anthropicMessage = JSON.stringify({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-mock",
  content: [{ type: "text", text: "Hi there" }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    cache_read_input_tokens: 7,
    cache_creation_input_tokens: 2,
  },
});

const geminiContent = JSON.stringify({
  candidates: [
    {
      content: { role: "model", parts: [{ text: "Hi there" }] },
      finishReason: "STOP",
      index: 0,
    },
  ],
  usageMetadata: {
    promptTokenCount: 10,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 2,
    cachedContentTokenCount: 3,
    totalTokenCount: 17,
  },
  modelVersion: "gemini-mock-version",
});

const mistralChat = JSON.stringify({
  id: "cmpl-1",
  object: "chat.completion",
  created: 1,
  model: "mistral-mock",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hi there" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const bedrockModel = "anthropic.claude-sonnet-4-20250514-v1:0";
const bedrockConverse = JSON.stringify({
  output: { message: { role: "assistant", content: [{ text: "Hi there" }] } },
  stopReason: "end_turn",
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    cacheReadInputTokens: 6,
    cacheWriteInputTokens: 1,
  },
  metrics: { latencyMs: 1 },
});

const server = createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    let body: string | undefined;
    if (pathname.startsWith("/openai")) {
      if (pathname.endsWith("/responses")) {
        body = openAIResponses;
      } else if (pathname.endsWith("/chat/completions")) {
        body = openAIChat;
      }
    } else if (pathname.startsWith("/anthropic")) {
      body = anthropicMessage;
    } else if (pathname.startsWith("/gemini")) {
      body = geminiContent;
    } else if (pathname.startsWith("/mistral")) {
      body = mistralChat;
    } else if (pathname.startsWith("/bedrock")) {
      body = bedrockConverse;
    }
    if (!body) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end("{}");
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
});

let origin: string;
let agent: ReturnType<typeof startTestAgent> | undefined;
t.before(async () => {
  process.env[ENV_NAME] = "true";
  if (!skip) {
    agent = startTestAgent({
      token: new Token("123"),
      // openai v4 uses node-fetch (node:http), the others use fetch (undici)
      wrappers: [new Undici(), new Fetch(), new HTTPRequest()],
      rewrite: {},
    });
  }
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
t.teardown(() => new Promise<void>((resolve) => server.close(() => resolve())));

t.after(() => {
  if (originalEnvValue === undefined) {
    delete process.env[ENV_NAME];
  } else {
    process.env[ENV_NAME] = originalEnvValue;
  }
});

type Tokens = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

function expectStats(t: Test, model: string, tokens: Tokens, message?: string) {
  t.same(
    agent!.getAIStatistics().getStats(),
    [
      {
        provider: origin,
        model,
        calls: 1,
        tokens: { ...tokens, total: tokens.input + tokens.output },
      },
    ],
    ...(message ? [message] : [])
  );
  agent!.getAIStatistics().reset();
}

t.afterEach(() => {
  agent?.getAIStatistics().reset();
});

for (const pkg of ["openai-v4", "openai-v5", "openai-v6", "openai-v7"]) {
  t.test(
    `it captures ${pkg} chat completions and responses`,
    { skip },
    async (t) => {
      const { OpenAI } = require(pkg) as typeof import("openai-v7");
      const client = new OpenAI({
        apiKey: "test",
        baseURL: `${origin}/openai/v1`,
        maxRetries: 0,
      });

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
      });
      t.equal(completion.choices[0].message.content, "Hi there");
      expectStats(
        t,
        "gpt-4o-mock",
        { input: 10, output: 5, cacheRead: 4, cacheWrite: 0 },
        "chat completions"
      );

      const response = await client.responses.create({
        model: "gpt-5",
        input: "Hi",
      });
      t.equal(response.output_text, "Hi there");
      expectStats(
        t,
        "gpt-5-mock",
        { input: 12, output: 6, cacheRead: 3, cacheWrite: 0 },
        "responses"
      );
    }
  );
}

t.test("it captures @anthropic-ai/sdk messages", { skip }, async (t) => {
  const sdk = require("@anthropic-ai/sdk");
  const Anthropic = sdk.default ?? sdk;
  const client = new Anthropic({
    apiKey: "test",
    baseURL: `${origin}/anthropic`,
    maxRetries: 0,
  });
  const message = await client.messages.create({
    max_tokens: 100,
    model: "claude-haiku-5-5",
    messages: [{ role: "user", content: "Hi" }],
  });
  t.equal(message.content[0].text, "Hi there");
  expectStats(t, "claude-mock", {
    input: 10,
    output: 5,
    cacheRead: 7,
    cacheWrite: 2,
  });
});

for (const pkg of ["@google/genai-v1", "@google/genai-v2"]) {
  t.test(`it captures ${pkg} generateContent`, { skip }, async (t) => {
    const { GoogleGenAI } = require(pkg) as typeof import("@google/genai-v2");
    const ai = new GoogleGenAI({
      apiKey: "test",
      httpOptions: { baseUrl: `${origin}/gemini` },
    });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hi",
    });
    t.equal(response.text, "Hi there");

    expectStats(t, "gemini-mock-version", {
      input: 10,
      output: 7,
      cacheRead: 3,
      cacheWrite: 0,
    });

    const chat = ai.chats.create({ model: "gemini-2.5-flash" });
    await chat.sendMessage({ message: "Hi" });
    expectStats(t, "gemini-mock-version", {
      input: 10,
      output: 7,
      cacheRead: 3,
      cacheWrite: 0,
    });
  });
}

for (const pkg of ["mistralai-v1", "mistralai-v2"]) {
  t.test(`it captures ${pkg} chat completions`, { skip }, async (t) => {
    const { Mistral } = require(pkg) as typeof import("mistralai-v2");
    const mistral = new Mistral({
      apiKey: "test",
      serverURL: `${origin}/mistral`,
      retryConfig: { strategy: "none" },
    });
    const result = await mistral.chat.complete({
      model: "mistral-medium",
      messages: [{ role: "user", content: "Hi" }],
    });
    t.equal(result.choices[0].message.content, "Hi there");
    expectStats(t, "mistral-mock", {
      input: 10,
      output: 5,
      cacheRead: 0,
      cacheWrite: 0,
    });
  });
}

const aiSdkVersions = [
  ["ai-v4", "@ai-sdk/google-v1"],
  ["ai-v5", "@ai-sdk/google-v2"],
  ["ai-v6", "@ai-sdk/google-v3"],
  ["ai-v7", "@ai-sdk/google-v3"],
] as const;

for (const [pkg, googlePkg] of aiSdkVersions) {
  t.test(`it captures ${pkg} with ${googlePkg}`, { skip }, async (t) => {
    const { generateText } = require(pkg) as typeof import("ai-v7");
    const { createGoogleGenerativeAI } = require(
      googlePkg
    ) as typeof import("@ai-sdk/google-v3");
    const google = createGoogleGenerativeAI({
      apiKey: "test",
      baseURL: `${origin}/gemini`,
    });
    const result = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: "Hi",
      maxRetries: 0,
    });
    t.equal(result.text, "Hi there");
    expectStats(t, "gemini-mock-version", {
      input: 10,
      output: 7,
      cacheRead: 3,
      cacheWrite: 0,
    });
  });
}

t.test("it captures AWS Bedrock Converse", { skip }, async (t) => {
  const { BedrockRuntimeClient, ConverseCommand } =
    require("@aws-sdk/client-bedrock-runtime") as typeof import("@aws-sdk/client-bedrock-runtime");
  const { NodeHttpHandler } =
    require("@smithy/node-http-handler") as typeof import("@smithy/node-http-handler");
  const client = new BedrockRuntimeClient({
    requestHandler: new NodeHttpHandler(),
    region: "us-east-1",
    endpoint: `${origin}/bedrock`,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    maxAttempts: 1,
  });
  t.teardown(() => client.destroy());
  const response = await client.send(
    new ConverseCommand({
      modelId: bedrockModel,
      messages: [{ role: "user", content: [{ text: "Hi" }] }],
    })
  );
  t.same(response.output?.message?.content, [{ text: "Hi there" }]);
  expectStats(t, bedrockModel, {
    input: 10,
    output: 5,
    cacheRead: 6,
    cacheWrite: 1,
  });
});

t.test(
  "it does not capture unknown paths from real SDKs",
  { skip },
  async (t) => {
    const { OpenAI } = require("openai-v7") as typeof import("openai-v7");
    const client = new OpenAI({
      apiKey: "test",
      baseURL: `${origin}/openai/v1`,
      maxRetries: 0,
    });
    await t.rejects(client.embeddings.create({ model: "x", input: "Hi" }));
    t.same(agent!.getAIStatistics().getStats(), []);
  }
);
