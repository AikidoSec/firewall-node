import * as t from "tap";
import { once } from "events";
import { readFileSync } from "fs";
import {
  createServer,
  request,
  get,
  type IncomingMessage,
  type RequestListener,
} from "http";
import {
  createServer as createHTTPSServer,
  request as httpsRequest,
  get as httpsGet,
} from "https";
import { createServer as createNetServer, type AddressInfo } from "net";
import { channel } from "diagnostics_channel";

import { resolve } from "path";
import { gzipSync } from "zlib";
import { startTestAgent } from "../helpers/startTestAgent";
import { getSemverNodeVersion } from "../helpers/getNodeVersion";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { AIProviderTraffic } from "./AIProviderTraffic";
import { AiSDK } from "./AiSDK";
import { OpenAI } from "./OpenAI";
import { setAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";

const body = JSON.stringify({
  model: "test-model",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: "hello",
        tool_calls: [
          {
            id: "call-1",
            type: "function",
            function: { name: "weather", arguments: "{}" },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 4 },
});
const stream =
  [
    {
      id: "chat-stream",
      model: "test-model",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                function: { name: "weather", arguments: "" },
              },
            ],
          },
        },
      ],
    },
    {
      choices: [
        {
          index: 0,
          delta: { tool_calls: [{ index: 0, function: { arguments: "{}" } }] },
        },
      ],
    },
    { choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } },
  ]
    .map((event) => `data: ${JSON.stringify(event)}\n\n`)
    .join("") + "data: [DONE]\n\n";

const geminiStream = [
  {
    responseId: "gemini-stream",
    modelVersion: "gemini-2.5-flash",
    candidates: [{ content: { role: "model", parts: [{ text: "hello" }] } }],
  },
  {
    responseId: "gemini-stream",
    modelVersion: "gemini-2.5-flash",
    candidates: [
      {
        content: { role: "model", parts: [{ text: " world" }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
  },
]
  .map((event) => `data: ${JSON.stringify(event)}\n\n`)
  .join("");
const agent = startTestAgent({
  wrappers: [new AIProviderTraffic(), new OpenAI(), new AiSDK()],
  rewrite: { openai: "openai-v5", ai: "ai-v7" },
});
const handle: RequestListener = (req, res) => {
  const payload = req.url?.includes("streamGenerateContent")
    ? geminiStream
    : req.url?.includes("stream")
      ? stream
      : body;
  if (req.url?.includes("error")) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(body);
    return;
  }
  const gzip = req.headers["accept-encoding"]?.includes("gzip");
  res.writeHead(200, {
    "content-type":
      payload === stream || payload === geminiStream
        ? "text/event-stream"
        : "application/json",
    ...(gzip ? { "content-encoding": "gzip" } : {}),
  });
  const bytes = gzip ? gzipSync(payload) : Buffer.from(payload);
  res.write(bytes.subarray(0, 17));
  res.end(bytes.subarray(17));
};
const httpServer = createServer(handle);
const httpsServer = createHTTPSServer(
  {
    key: readFileSync(resolve(__dirname, "../sources/fixtures/key.pem")),
    cert: readFileSync(resolve(__dirname, "../sources/fixtures/cert.pem")),
  },
  handle
);
let baseURL = "";
let secureURL = "";
t.before(async () => {
  httpServer.listen(0, "127.0.0.1");
  httpsServer.listen(0, "127.0.0.1");
  await Promise.all([
    once(httpServer, "listening"),
    once(httpsServer, "listening"),
  ]);
  baseURL = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  secureURL = `https://127.0.0.1:${(httpsServer.address() as AddressInfo).port}`;
});
t.teardown(() => {
  httpServer.close();
  httpsServer.close();
});
t.beforeEach(() => {
  agent.getAIStatistics().reset();
  setAINetworkCaptureActive(
    isVersionGreaterOrEqual("7.11.0", process.versions.undici ?? "")
  );
});

async function readResponse(response: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of response) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function expectedTools(calls = 1) {
  return [{ name: "weather", calls, blocked: 0 }];
}

t.test(
  "HTTP and HTTPS capture without forcing delayed readers into flowing mode",
  async (t) => {
    new AIProviderTraffic().wrap();
    for (const client of [request, get, httpsRequest, httpsGet]) {
      const secure = client === httpsRequest || client === httpsGet;
      const req = client(
        `${secure ? secureURL : baseURL}/v1/chat/completions`,
        { method: "POST", ...(secure ? { rejectUnauthorized: false } : {}) }
      );
      const responsePromise = once(req, "response");
      if (client === request || client === httpsRequest) req.end("{}");
      const [response] = (await responsePromise) as [IncomingMessage];
      await new Promise<void>((resolve) => setImmediate(resolve));
      t.equal(
        response.readableFlowing,
        null,
        "capture does not start consumption"
      );
      t.equal((await readResponse(response)).toString(), body);
    }
    t.same(agent.getAIStatistics().getToolCallStats(), expectedTools(4));
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "openai_compatible",
        model: "test-model",
        calls: 4,
        tokens: { input: 40, output: 16, total: 56 },
      },
    ]);
  }
);

t.test(
  "fetch captures JSON and SSE without changing their bytes",
  {
    skip: !isVersionGreaterOrEqual("7.11.0", process.versions.undici ?? "")
      ? "Bundled Undici does not publish response chunks"
      : undefined,
  },
  async (t) => {
    for (const path of [
      "/v1/chat/completions",
      "/stream/v1/chat/completions",
    ]) {
      const response = await fetch(baseURL + path, {
        method: "POST",
        headers: { "accept-encoding": "identity" },
        body: "{}",
      });
      t.equal(await response.text(), path.includes("stream") ? stream : body);
    }
    t.same(agent.getAIStatistics().getToolCallStats(), expectedTools(2));
    t.match(agent.getAIStatistics().getStats(), [
      { calls: 2, tokens: { input: 20, output: 8, total: 28 } },
    ]);
  }
);

t.test(
  "standalone Undici capture depends on the emitting version, not bundled Undici",
  async (t) => {
    for (const name of ["undici-v7-old", "undici-v7", "undici-v8"] as const) {
      if (
        !isVersionGreaterOrEqual(
          name === "undici-v8" ? "22.19.0" : "20.18.1",
          getSemverNodeVersion()
        )
      )
        continue;
      agent.getAIStatistics().reset();
      const { request: undiciRequest, Agent } = require(
        name
      ) as typeof import("undici-v7");
      const dispatcher = new Agent();
      const response = await undiciRequest(
        `${baseURL}/stream/v1/chat/completions`,
        { method: "POST", body: "{}", dispatcher }
      );
      t.equal(await response.body.text(), stream);
      await dispatcher.close();
      t.same(
        agent.getAIStatistics().getToolCallStats(),
        name === "undici-v7-old" ? [] : expectedTools(),
        name
      );
    }
  }
);

t.test(
  "compressed HTTP responses are observed without modifying the original buffers",
  async (t) => {
    const reported = new Promise<void>((resolve) => {
      const original = agent
        .getAIStatistics()
        .onAIToolCall.bind(agent.getAIStatistics());
      agent.getAIStatistics().onAIToolCall = (call) => {
        original(call);
        resolve();
      };
      t.teardown(() => {
        agent.getAIStatistics().onAIToolCall = original;
      });
    });
    const req = request(`${baseURL}/v1/chat/completions`, {
      method: "POST",
      headers: { "accept-encoding": "gzip" },
    });
    req.end("{}");
    const [response] = (await once(req, "response")) as [IncomingMessage];
    t.same(await readResponse(response), gzipSync(body));
    await reported;
    t.same(agent.getAIStatistics().getToolCallStats(), expectedTools());
  }
);

t.test(
  "OpenAI SDK falls back while inactive and stops reporting when diagnostics capture starts",
  {
    skip: !isVersionGreaterOrEqual("20.18.1", getSemverNodeVersion())
      ? "Undici v7 requires Node 20.18.1+"
      : undefined,
  },
  async (t) => {
    const { OpenAI: Client } =
      require("openai-v5") as typeof import("openai-v5");
    for (const encoding of ["identity", "gzip"]) {
      for (const name of ["undici-v7-old", "undici-v7", "bundled"] as const) {
        agent.getAIStatistics().reset();
        if (
          name === "bundled" &&
          !isVersionGreaterOrEqual("7.11.0", process.versions.undici ?? "")
        )
          continue;
        setAINetworkCaptureActive(false);
        const transport = require(
          name === "bundled" ? "undici-v7" : name
        ) as typeof import("undici-v7");
        const original = agent
          .getAIStatistics()
          .onAIToolCall.bind(agent.getAIStatistics());
        const captured =
          name !== "undici-v7-old"
            ? new Promise<void>((resolve) => {
                agent.getAIStatistics().onAIToolCall = (call) => {
                  original(call);
                  resolve();
                };
              })
            : undefined;
        const dispatcher = new transport.Agent();
        const client = new Client({
          apiKey: "test",
          baseURL: `${baseURL}/fallback/${name}/${encoding}/v1`,
          fetch:
            name === "bundled"
              ? fetch
              : (((
                  url: Parameters<typeof fetch>[0],
                  options: Parameters<typeof fetch>[1]
                ) =>
                  transport.fetch(
                    url as string,
                    { ...options, dispatcher } as Parameters<
                      typeof transport.fetch
                    >[1]
                  )) as unknown as typeof fetch),
          defaultHeaders: { "accept-encoding": encoding },
        });
        const result = await client.chat.completions.create({
          model: "test-model",
          messages: [{ role: "user", content: "hello" }],
        });
        await dispatcher.close();
        await captured;
        agent.getAIStatistics().onAIToolCall = original;
        t.equal(result.choices[0].message.tool_calls?.length, 1);
        t.match(agent.getAIStatistics().getStats(), [{ calls: 1 }], name);
        t.same(
          agent.getAIStatistics().getToolCallStats(),
          name === "undici-v7-old" ? [] : expectedTools()
        );
        if (name !== "undici-v7-old")
          t.equal(
            agent.getAIStatistics().getStats()[0].provider,
            "openai_compatible"
          );
      }
    }
  }
);

t.test(
  "ignores unrelated traffic, unsuccessful responses, and malformed diagnostic messages",
  async (t) => {
    for (const path of ["/other", "/error/v1/chat/completions"]) {
      const req = request(baseURL + path, { method: "POST" });
      req.end("{}");
      const [response] = (await once(req, "response")) as [IncomingMessage];
      t.equal((await readResponse(response)).toString(), body);
    }
    t.doesNotThrow(() => channel("undici:request:headers").publish({}));
    t.doesNotThrow(() => channel("http.client.response.finish").publish({}));
    t.same(agent.getAIStatistics().getStats(), []);
    t.same(agent.getAIStatistics().getToolCallStats(), []);
  }
);

t.test(
  "aborted HTTP and Undici responses do not report partial tool calls",
  async (t) => {
    const partial = stream.slice(0, stream.indexOf("data: ", 6));
    const broken = createNetServer((socket) => {
      socket.once("data", () =>
        socket.end(
          `HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: ${Buffer.byteLength(partial) + 100}\r\n\r\n${partial}`
        )
      );
    });
    broken.listen(0, "127.0.0.1");
    await once(broken, "listening");
    t.teardown(() => broken.close());
    const url = `http://127.0.0.1:${(broken.address() as AddressInfo).port}/v1/chat/completions`;
    const req = request(url, { method: "POST" });
    req.end("{}");
    const [response] = (await once(req, "response")) as [IncomingMessage];
    await t.rejects(readResponse(response));
    if (isVersionGreaterOrEqual("20.18.1", getSemverNodeVersion())) {
      const { request: undiciRequest, Agent } =
        require("undici-v7") as typeof import("undici-v7");
      const dispatcher = new Agent();
      const result = await undiciRequest(url, { method: "POST", dispatcher });
      await t.rejects(result.body.text());
      await dispatcher.close();
    }
    t.same(agent.getAIStatistics().getToolCallStats(), []);
    t.same(agent.getAIStatistics().getStats(), []);
  }
);

t.test(
  "AI SDK stream usage is reported once when network capture is active",
  {
    skip: !isVersionGreaterOrEqual("7.11.0", process.versions.undici ?? "")
      ? "Bundled Undici does not publish response chunks"
      : undefined,
  },
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
      prompt: "hello",
    });
    let text = "";
    for await (const chunk of result.textStream) text += chunk;
    await result.usage;
    t.equal(text, "hello world");
    t.match(agent.getAIStatistics().getStats(), [
      {
        provider: "gemini_compatible",
        model: "gemini-2.5-flash",
        calls: 1,
        tokens: { input: 10, output: 4, total: 14 },
      },
    ]);
  }
);
