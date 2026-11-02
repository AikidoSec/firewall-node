process.env.AIKIDO_FEATURE_AI_NETWORK_CAPTURE = "true";

import * as t from "tap";
import { createServer, request, type IncomingMessage } from "http";
import type { AddressInfo } from "net";
import { Token } from "../agent/api/Token";
import { startTestAgent } from "../helpers/startTestAgent";
import { isAIProviderTrafficCaptureEnabled } from "./isAIProviderTrafficCaptureEnabled";
import { Undici } from "../sinks/Undici";
import { Fetch } from "../sinks/Fetch";
import { HTTPRequest } from "../sinks/HTTPRequest";
import { OpenAI as OpenAISink } from "../sinks/OpenAI";
import { AwsSDKVersion3 } from "../sinks/AwsSDKVersion3";

const skip = isAIProviderTrafficCaptureEnabled()
  ? undefined
  : "Needs Node.js 24+";
const model = "gpt-4o";
const jsonBody = JSON.stringify({
  model,
  choices: [{ message: { role: "assistant", content: "Hi 👋" } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});
const bedrockModel = "anthropic.claude-sonnet-4-20250514-v1:0";
const bedrockBody = JSON.stringify({
  output: { message: { role: "assistant", content: [{ text: "Hi 👋" }] } },
  usage: { inputTokens: 10, outputTokens: 5 },
});
const server = createServer((req, res) => {
  req.resume();
  req.on("end", () => {
    res.writeHead(req.url?.includes("error") ? 429 : 200, {
      "content-type": "application/json",
    });
    if (req.url?.includes("invalid")) {
      res.end('{"model":');
    } else if (req.url?.endsWith("/converse")) {
      res.end(bedrockBody);
    } else {
      res.end(jsonBody);
    }
  });
});
let port: number;
t.before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
t.teardown(() => new Promise<void>((resolve) => server.close(() => resolve())));

const agent = startTestAgent({
  token: new Token("123"),
  wrappers: [
    new Undici(),
    new OpenAISink(),
    new AwsSDKVersion3(),
    new Fetch(),
    new HTTPRequest(),
  ],
  rewrite: { openai: "openai-v7" },
});

function expected(provider: string, modelName = model) {
  return {
    provider,
    model: modelName,
    calls: 1,
    tokens: { input: 10, output: 5, total: 15 },
  };
}

async function read(response: IncomingMessage): Promise<string> {
  let result = "";
  for await (const chunk of response) {
    result += chunk;
  }
  return result;
}

function httpPost(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    request(url, { method: "POST" }, resolve).on("error", reject).end();
  });
}

t.test(
  "it captures OpenAI SDK requests on a custom host alongside SDK stats",
  { skip },
  async (t) => {
    const { OpenAI } = require("openai-v7") as typeof import("openai-v7");
    const client = new OpenAI({
      apiKey: "test",
      baseURL: `http://127.0.0.1:${port}/v1`,
      maxRetries: 0,
    });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hi" }],
    });
    t.equal(completion.choices[0].message.content, "Hi 👋");
    t.same(agent.getAIStatistics().getStats(), [
      expected(`http://127.0.0.1:${port}/v1/chat/completions`),
      expected("openai"),
    ]);
    agent.getAIStatistics().reset();
  }
);

t.test(
  "it captures fetch and Undici requests through a proxy path",
  { skip },
  async (t) => {
    const url = `http://127.0.0.1:${port}/proxy/v1/chat/completions`;
    const response = await fetch(url, { method: "POST" });
    t.equal(await response.text(), jsonBody);
    t.same(agent.getAIStatistics().getStats(), [expected(url)]);
    agent.getAIStatistics().reset();

    for (const pkg of ["undici-v7", "undici-v8"]) {
      const undici = require(pkg) as typeof import("undici-v7");
      const response = await undici.request(url, { method: "POST" });
      t.equal(await response.body.text(), jsonBody, pkg);
      t.same(agent.getAIStatistics().getStats(), [expected(url)], pkg);
      agent.getAIStatistics().reset();
    }
  }
);

t.test(
  "it observes HTTP responses without consuming or changing the app's bytes",
  { skip },
  async (t) => {
    const url = `http://localhost:${port}/v1/chat/completions`;
    const response = await httpPost(url);
    t.equal(response.readableFlowing, null);
    t.equal(await read(response), jsonBody);
    t.same(agent.getAIStatistics().getStats(), [expected(url)]);
    agent.getAIStatistics().reset();
  }
);

t.test(
  "it preserves AWS Bedrock's deferred response consumption",
  { skip },
  async (t) => {
    const { BedrockRuntimeClient, ConverseCommand } =
      require("@aws-sdk/client-bedrock-runtime") as typeof import("@aws-sdk/client-bedrock-runtime");
    const { NodeHttpHandler } =
      require("@smithy/node-http-handler") as typeof import("@smithy/node-http-handler");
    const client = new BedrockRuntimeClient({
      requestHandler: new NodeHttpHandler(),
      region: "us-east-1",
      endpoint: `http://localhost:${port}`,
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
    t.same(response.output?.message?.content, [{ text: "Hi 👋" }]);
    t.same(response.usage, { inputTokens: 10, outputTokens: 5 });
    t.same(agent.getAIStatistics().getStats(), [
      expected(
        `http://localhost:${port}/model/${encodeURIComponent(bedrockModel)}/converse`,
        bedrockModel
      ),
      expected("bedrock", bedrockModel),
    ]);
    agent.getAIStatistics().reset();
  }
);

t.test(
  "it never reports URL credentials, query strings or fragments",
  { skip },
  async (t) => {
    const url = `http://127.0.0.1:${port}/v1/chat/completions`;
    const response = await fetch(`${url}?api_key=secret#fragment`, {
      method: "POST",
    });
    t.equal(await response.text(), jsonBody);
    t.same(agent.getAIStatistics().getStats(), [expected(url)]);
    agent.getAIStatistics().reset();

    const httpResponse = await httpPost(
      `${url.replace("http://", "http://user:password@")}?api_key=secret#fragment`
    );
    t.equal(await read(httpResponse), jsonBody);
    t.same(agent.getAIStatistics().getStats(), [expected(url)]);
    agent.getAIStatistics().reset();
  }
);

t.test(
  "it ignores failed requests, malformed JSON and other API paths",
  { skip },
  async (t) => {
    for (const path of [
      "/v1/embeddings",
      "/error/v1/chat/completions",
      "/invalid/v1/chat/completions",
    ]) {
      const url = `http://127.0.0.1:${port}${path}`;
      const response = await fetch(url, { method: "POST" });
      await response.text();
      await read(await httpPost(url));
      t.same(agent.getAIStatistics().getStats(), [], path);
    }
  }
);

t.test(
  "reporting errors do not break the application's HTTP calls",
  { skip },
  async (t) => {
    const original = agent.getAIStatistics().onAICall;
    agent.getAIStatistics().onAICall = () => {
      throw new Error("reporting failed");
    };
    try {
      const url = `http://127.0.0.1:${port}/v1/chat/completions`;
      const response = await fetch(url, { method: "POST" });
      t.equal(await response.text(), jsonBody);
      t.equal(await read(await httpPost(url)), jsonBody);
    } finally {
      agent.getAIStatistics().onAICall = original;
    }
  }
);
