import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { Token } from "../agent/api/Token";
import { resolveBinaryPath } from "./binary";
import { AiCoreServer } from "./coreServer";
import { ProxySupervisor } from "./supervisor";
import { clearRuntimeInfo, readRuntimeInfo } from "./runtime";
import { createZenFetch, resetFetchCache } from "./fetch";
import { FakeUpstream, sse } from "./testHelpers/fakeUpstream";

const binaryPath = resolveBinaryPath();

const TOOLS = [
  {
    name: "run_sql",
    description: "Run a SQL query against the production database",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The SQL to execute" },
      },
      required: ["query"],
    },
  },
  {
    name: "Bash",
    description: "Run a shell command",
    input_schema: {
      type: "object",
      properties: { command: { type: "string", description: "command" } },
      required: ["command"],
    },
  },
];

const NON_STREAMING = {
  body: JSON.stringify({
    id: "msg_01",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [
      {
        type: "tool_use",
        id: "toolu_01",
        name: "run_sql",
        input: { query: "SELECT 1" },
      },
    ],
    stop_reason: "tool_use",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
};

const BASH_ENV_STREAM = sse(
  [
    "event: message_start",
    'data: {"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"claude-sonnet-5","content":[],"stop_reason":null,"usage":{"input_tokens":10,"output_tokens":0}}}',
    "",
    "event: content_block_start",
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"Bash","input":{}}}',
    "",
    "event: content_block_delta",
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"command\\": \\"cat "}}',
    "",
    "event: content_block_delta",
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":".env\\"}"}}',
    "",
    "event: content_block_stop",
    'data: {"type":"content_block_stop","index":0}',
    "",
    "event: message_delta",
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":9}}',
    "",
    "event: message_stop",
    'data: {"type":"message_stop"}',
    "",
    "",
  ].join("\n")
);

async function waitUntil(
  predicate: () => boolean,
  timeoutMs = 25_000
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function withWiredProxy(
  opts: { blockedAiTools?: string[] },
  fn: (ctx: {
    token: string;
    upstream: FakeUpstream;
    events: Record<string, unknown>[];
  }) => Promise<void>
) {
  const token = `test-token-${Math.random().toString(36).slice(2)}`;
  const events: Record<string, unknown>[] = [];

  const upstream = new FakeUpstream();
  await upstream.start();

  const coreServer = new AiCoreServer(
    () => ({ aiEnabled: true, blockedAiTools: opts.blockedAiTools ?? [] }),
    (event) => events.push(event)
  );
  await coreServer.start();

  const supervisor = new ProxySupervisor(
    token,
    coreServer.url,
    binaryPath!,
    `http://127.0.0.1:${upstream.port}`
  );
  supervisor.start();

  try {
    const ready = await waitUntil(
      () => readRuntimeInfo(token) !== undefined,
      30_000
    );
    if (!ready) {
      throw new Error("proxy never published its runtime file");
    }
    await fn({ token, upstream, events });
  } finally {
    supervisor.stop();
    await coreServer.stop();
    await upstream.stop();
    clearRuntimeInfo(token);
    resetFetchCache();
  }
}

function eventsOf(events: Record<string, unknown>[], type: string) {
  return events.filter((e) => e.type === type);
}

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}

t.test(
  "ai proxy: tool descriptions, arg schemas, streaming hits, blocking",
  {
    skip: binaryPath
      ? undefined
      : "No AI proxy binary found; set AIKIDO_AI_PROXY_BIN",
  },
  async (t) => {
    await t.test("reports tool descriptions and arg schemas", async (t) => {
      await withWiredProxy({}, async ({ token, upstream, events }) => {
        upstream.responses = {
          "api.anthropic.com": [["/v1/messages", NON_STREAMING]],
        };

        const zenFetch = createZenFetch(token);
        const res = await zenFetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 64,
            tools: TOOLS,
            messages: [{ role: "user", content: "read the db" }],
          }),
        });
        await res.text();

        await waitUntil(() => eventsOf(events, "ai-usage").length > 0);
        const usage = eventsOf(events, "ai-usage");
        t.ok(usage.length > 0, "expected an ai-usage event");

        const tools = last(usage).tools as any[];
        const byName = Object.fromEntries(tools.map((tl) => [tl.name, tl]));
        t.match(byName.run_sql.description, /production database/);
        t.ok(byName.run_sql.args.some((a: any) => a.name === "query"));
      });
    });

    await t.test("streaming tool call is reported as a tool hit", async (t) => {
      await withWiredProxy({}, async ({ upstream, events, token }) => {
        upstream.responses = {
          "api.anthropic.com": [["/v1/messages", BASH_ENV_STREAM]],
        };

        const zenFetch = createZenFetch(token);
        const res = await zenFetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 64,
            tools: TOOLS,
            messages: [{ role: "user", content: "read the env file" }],
          }),
        });
        // drain the SSE body so the proxy finishes scanning it
        await res.text();

        t.ok(
          await waitUntil(() => eventsOf(events, "ai-tool-hits").length > 0)
        );
        const hits = last(eventsOf(events, "ai-tool-hits")).tools as any[];
        t.ok(hits.some((tl) => tl.name === "Bash"));
      });
    });

    await t.test(
      "blocked tool is stripped from the request the provider receives",
      async (t) => {
        await withWiredProxy(
          { blockedAiTools: ["run_sql"] },
          async ({ upstream, events, token }) => {
            upstream.responses = {
              "api.anthropic.com": [["/v1/messages", NON_STREAMING]],
            };

            const zenFetch = createZenFetch(token);
            const res = await zenFetch(
              "https://api.anthropic.com/v1/messages",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: "claude-sonnet-5",
                  max_tokens: 64,
                  tools: TOOLS,
                  messages: [{ role: "user", content: "hi" }],
                }),
              }
            );
            await res.text();

            await waitUntil(() => upstream.requests.length > 0);
            const sent = JSON.parse(last(upstream.requests).body);
            const sentToolNames = sent.tools.map((tl: any) => tl.name);
            t.notOk(sentToolNames.includes("run_sql"));
            t.ok(sentToolNames.includes("Bash"));

            await waitUntil(() => eventsOf(events, "ai-usage").length > 0);
            const byName = Object.fromEntries(
              (last(eventsOf(events, "ai-usage")).tools as any[]).map((tl) => [
                tl.name,
                tl,
              ])
            );
            t.equal(byName.run_sql.blocked, true);
          }
        );
      }
    );

    await t.test(
      "agent.reportEvent forwards AI events to the reporting API",
      async (t) => {
        const testToken = new Token("test-agent-token");
        const agent = createTestAgent({ token: testToken });

        agent.reportEvent({
          type: "ai-usage",
          provider: "anthropic",
          model: "claude-sonnet-5",
          tools: [
            { name: "run_sql", description: "desc", args: [], blocked: false },
          ],
        });

        const reported = (agent as any).api.getEvents();
        t.equal(reported.length, 1);
        t.equal(reported[0].type, "ai-usage");
        t.ok(reported[0].time);
        t.ok(reported[0].agent);
      }
    );
  }
);
