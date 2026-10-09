import * as t from "tap";
import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as tls from "tls";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { setTimeout } from "timers/promises";
import { createTestAgent } from "../../helpers/createTestAgent";
import { wrap } from "../../helpers/wrap";
import { Fetch } from "../../sinks/Fetch";
import { HTTPRequest } from "../../sinks/HTTPRequest";
import { AIStatistics } from "../AIStatistics";
import { LoggerNoop } from "../logger/LoggerNoop";
import { getZenProxyBinaryPath, ZenProxy } from "./ZenProxy";

const hasSetGlobalProxyFromEnv =
  typeof (http as { setGlobalProxyFromEnv?: unknown }).setGlobalProxyFromEnv ===
  "function";

const skip =
  (!existsSync(getZenProxyBinaryPath()) && "zen-proxy binary not found") ||
  (!hasSetGlobalProxyFromEnv && "requires http.setGlobalProxyFromEnv") ||
  (process.env.NODE_USE_ENV_PROXY &&
    "the Zen proxy does not support NODE_USE_ENV_PROXY");

// Otherwise ZenProxy passes an inherited CA bundle as extra --upstream-ca to the proxy
delete process.env.NODE_EXTRA_CA_CERTS;

// Direct (non proxied) connections to api.openai.com end up on 127.0.0.1, where nothing listens on 443
wrap(dns, "lookup", function lookup(original) {
  return function lookup(this: unknown, ...args: unknown[]) {
    if (args[0] === "api.openai.com") {
      args[0] = "127.0.0.1";
    }

    return original.apply(this, args);
  };
});

const fixtures = join(__dirname, "fixtures");
const cert = readFileSync(join(fixtures, "upstream.crt"), "utf8");
const key = readFileSync(join(fixtures, "upstream.key"), "utf8");

const chatCompletion = JSON.stringify({
  id: "chatcmpl-1",
  object: "chat.completion",
  model: "gpt-4o-mini",
  choices: [
    {
      index: 0,
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_weather", arguments: '{"city":"Ghent"}' },
          },
        ],
      },
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

const anthropicStream = [
  {
    type: "message_start",
    message: {
      model: "claude-sonnet-4-5",
      usage: { input_tokens: 20, output_tokens: 1 },
    },
  },
  {
    type: "content_block_start",
    index: 0,
    content_block: {
      type: "tool_use",
      id: "toolu_1",
      name: "search",
      input: {},
    },
  },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: {}, usage: { output_tokens: 7 } },
  { type: "message_stop" },
]
  .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  .join("");

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as net.AddressInfo).port);
    });
  });
}

async function startFakeUpstream() {
  let requests = 0;
  const upstream = https.createServer({ cert, key }, (req, res) => {
    requests++;
    req.resume();
    req.on("end", () => {
      if (req.url === "/v1/messages") {
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(anthropicStream);
        return;
      }

      res.writeHead(200, { "content-type": "application/json" });
      res.end(chatCompletion);
    });
  });
  upstream.on("upgrade", (_req, socket: net.Socket) => {
    requests++;
    socket.destroy();
  });
  const upstreamPort = await listen(upstream);

  const connectProxy = http.createServer();
  connectProxy.on("connect", (_req, socket: net.Socket, head) => {
    const tunnel = net.connect(upstreamPort, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      tunnel.write(head);
      tunnel.pipe(socket);
      socket.pipe(tunnel);
    });
    tunnel.on("error", () => socket.destroy());
    socket.on("error", () => tunnel.destroy());
  });
  const proxyPort = await listen(connectProxy);

  return {
    proxyPort,
    requests: () => requests,
    close() {
      upstream.closeAllConnections();
      upstream.close();
      connectProxy.close();
    },
  };
}

function httpsPost(
  url: string,
  body: string,
  options: https.RequestOptions = {}
): Promise<string> {
  // Required after the agent started, so that https.request is wrapped
  const { request } = require("https") as typeof import("https");

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        ...options,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve(text));
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) {
    await setTimeout(50);
  }
}

t.test("it routes LLM calls through the Zen proxy", { skip }, async (t) => {
  const upstream = await startFakeUpstream();
  t.teardown(() => upstream.close());

  const agent = createTestAgent();
  agent.start([new Fetch(), new HTTPRequest()]);

  const zenProxy = agent.getZenProxy();
  zenProxy.start(false, [
    "--upstream-proxy",
    `http://127.0.0.1:${upstream.proxyPort}`,
    "--upstream-ca",
    join(fixtures, "upstream.crt"),
  ]);
  await waitFor(() => zenProxy.isEnabled());
  t.equal(zenProxy.isEnabled(), true, "proxy is ready");

  const stats = agent.getAIStatistics();
  const findStats = (provider: string) =>
    stats.getStats().find((s) => s.provider === provider);

  const body = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "What is the weather in Ghent?" }],
  });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  t.equal(await response.text(), chatCompletion);

  await waitFor(() => findStats("openai")?.calls === 1);
  t.same(findStats("openai"), {
    provider: "openai",
    model: "gpt-4o-mini",
    calls: 1,
    tokens: { input: 10, output: 5, total: 15, cacheRead: 0, cacheWrite: 0 },
    toolCalls: [{ name: "get_weather", calls: 1 }],
  });

  t.equal(
    await httpsPost("https://api.openai.com/v1/chat/completions", body),
    chatCompletion
  );
  await waitFor(() => findStats("openai")?.calls === 2);
  t.match(findStats("openai"), {
    calls: 2,
    tokens: { input: 20, output: 10 },
    toolCalls: [{ name: "get_weather", calls: 2 }],
  });

  const stream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 100,
      stream: true,
      messages: [{ role: "user", content: "Search for cats" }],
    }),
  });
  t.equal(await stream.text(), anthropicStream);

  await waitFor(() => findStats("anthropic") !== undefined);
  t.same(findStats("anthropic"), {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    calls: 1,
    tokens: { input: 20, output: 7, total: 27, cacheRead: 0, cacheWrite: 0 },
    toolCalls: [{ name: "search", calls: 1 }],
  });

  const requestsBefore = upstream.requests();

  // None of these are routed, so they go direct
  const upgradeError = await httpsPost(
    "https://api.openai.com/v1/realtime",
    "",
    { headers: { connection: "Upgrade", upgrade: "websocket" } }
  ).catch((error) => error);
  t.match(upgradeError, { code: "ECONNREFUSED", port: 443 });

  const createConnectionError = await httpsPost(
    "https://api.openai.com/v1/chat/completions",
    body,
    {
      port: 443,
      createConnection: (options) =>
        tls.connect(options as tls.ConnectionOptions),
    }
  ).catch((error) => error);
  t.match(createConnectionError, { code: "ECONNREFUSED", port: 443 });

  const customCAError = await httpsPost(
    "https://api.openai.com/v1/chat/completions",
    body,
    { ca: cert }
  ).catch((error) => error);
  t.match(customCAError, { code: "ECONNREFUSED", port: 443 });

  const httpsModule = require("https") as typeof import("https");
  const originalGlobalAgent = httpsModule.globalAgent;
  httpsModule.globalAgent = new (class extends https.Agent {})();
  const customGlobalAgentError = await httpsPost(
    "https://api.openai.com/v1/chat/completions",
    body
  )
    .catch((error) => error)
    .finally(() => {
      httpsModule.globalAgent = originalGlobalAgent;
    });
  t.match(customGlobalAgentError, { code: "ECONNREFUSED", port: 443 });

  const ws = new WebSocket("wss://api.openai.com/v1/realtime");
  await new Promise((resolve) => ws.addEventListener("error", resolve));

  t.equal(upstream.requests(), requestsBefore);
  await setTimeout(200);
  t.equal(findStats("openai")?.calls, 2, "not seen by the Zen proxy");

  const warnings: string[] = [];
  wrap(console, "warn", function warn() {
    return function warn(message: string) {
      warnings.push(message);
    };
  });

  // @ts-expect-error Private property, simulates a crash of the proxy
  zenProxy.child.kill("SIGKILL");
  await waitFor(() => !zenProxy.isEnabled());
  t.equal(zenProxy.isEnabled(), false);
  t.equal(warnings.length, 1);
  t.match(warnings[0], /The Zen proxy stopped \(signal SIGKILL\)/);

  const error = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    body,
  }).catch((error) => error);
  t.match(error.cause, { code: "ECONNREFUSED", port: 443 });
});

t.test(
  "the proxy trusts the CA from NODE_EXTRA_CA_CERTS",
  { skip },
  async (t) => {
    const upstream = await startFakeUpstream();
    t.teardown(() => upstream.close());

    process.env.NODE_EXTRA_CA_CERTS = join(fixtures, "upstream.crt");
    const zenProxy = new ZenProxy(new LoggerNoop(), new AIStatistics());
    try {
      zenProxy.start(false, [
        "--upstream-proxy",
        `http://127.0.0.1:${upstream.proxyPort}`,
      ]);
    } finally {
      delete process.env.NODE_EXTRA_CA_CERTS;
    }
    t.teardown(() => {
      // @ts-expect-error Private property
      zenProxy.child?.kill();
    });

    await waitFor(() => zenProxy.isEnabled());
    const url = "https://api.openai.com/v1/chat/completions";
    t.equal(
      await httpsPost(url, "{}", {
        agent: zenProxy.getHttpsAgent(),
      }),
      chatCompletion
    );
  }
);

t.test(
  "it ignores NODE_EXTRA_CA_CERTS when the file does not exist",
  { skip },
  async (t) => {
    process.env.NODE_EXTRA_CA_CERTS = join(fixtures, "missing.crt");
    const zenProxy = new ZenProxy(new LoggerNoop(), new AIStatistics());
    try {
      zenProxy.start(false);
    } finally {
      delete process.env.NODE_EXTRA_CA_CERTS;
    }
    t.teardown(() => {
      // @ts-expect-error Private property
      zenProxy.child?.kill();
    });

    await waitFor(() => zenProxy.isEnabled());
    t.equal(zenProxy.isEnabled(), true);
  }
);
