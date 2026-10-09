import * as t from "tap";
import * as http from "http";
import * as https from "https";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { AIStatistics } from "../AIStatistics";
import { LoggerNoop } from "../logger/LoggerNoop";
import {
  createZenProxyHostMatcher,
  getZenProxyBinaryPath,
  ZenProxy,
} from "./ZenProxy";

const hasSetGlobalProxyFromEnv =
  typeof (http as { setGlobalProxyFromEnv?: unknown }).setGlobalProxyFromEnv ===
  "function";

async function withGlobalAgent(
  globalAgent: https.Agent,
  fn: () => Promise<void>
) {
  const httpsModule = require("https") as { globalAgent: https.Agent };
  const original = httpsModule.globalAgent;
  httpsModule.globalAgent = globalAgent;
  try {
    await fn();
  } finally {
    httpsModule.globalAgent = original;
  }
}

const hosts = ["api.openai.com", "*.openai.azure.com", "api.anthropic.com"];
const ca = readFileSync(join(__dirname, "fixtures", "upstream.crt"), "utf8");
const readyLine = JSON.stringify({
  type: "ready",
  port: 12345,
  username: "zen",
  password: "secret",
  ca,
  hosts,
});

t.test("it matches exact hosts and one-label wildcards", async (t) => {
  const isZenProxyHost = createZenProxyHostMatcher([
    ...hosts,
    "bedrock-runtime.*.amazonaws.com",
  ]);
  t.equal(isZenProxyHost("api.openai.com"), true);
  t.equal(isZenProxyHost("my-resource.openai.azure.com"), true);
  t.equal(isZenProxyHost("bedrock-runtime.eu-west-1.amazonaws.com"), true);
  t.equal(isZenProxyHost("openai.azure.com"), false);
  t.equal(isZenProxyHost(".openai.azure.com"), false);
  t.equal(isZenProxyHost("a.b.openai.azure.com"), false);
  t.equal(isZenProxyHost("evilopenai.azure.com"), false);
  t.equal(isZenProxyHost("openai.com"), false);
  t.equal(isZenProxyHost("api.openai.com.evil.com"), false);
  t.equal(isZenProxyHost("bedrock-runtime.amazonaws.com"), false);
  t.equal(isZenProxyHost("s3.eu-west-1.amazonaws.com"), false);
});

t.test("the binary lives in the internals directory", async (t) => {
  t.equal(
    getZenProxyBinaryPath(),
    join(
      __dirname,
      "..",
      "..",
      "internals",
      `zen-proxy-${process.platform}-${process.arch}`
    )
  );
});

t.test("it throws in serverless environments", async (t) => {
  const proxy = new ZenProxy(new LoggerNoop(), new AIStatistics());
  t.throws(() => proxy.start(true), /not supported in serverless/);
  t.equal(proxy.isEnabled(), false);
});

t.test(
  "it throws when the binary is missing",
  {
    skip:
      (!hasSetGlobalProxyFromEnv && "requires setGlobalProxyFromEnv") ||
      (existsSync(getZenProxyBinaryPath()) && "binary is present"),
  },
  async (t) => {
    // Without proxyEnv, also when the tests run with NODE_USE_ENV_PROXY
    await withGlobalAgent(new https.Agent(), async () => {
      const proxy = new ZenProxy(new LoggerNoop(), new AIStatistics());
      t.throws(() => proxy.start(false), /is missing or not executable/);
    });
  }
);

t.test(
  "it throws with NODE_USE_ENV_PROXY",
  { skip: !hasSetGlobalProxyFromEnv && "requires setGlobalProxyFromEnv" },
  async (t) => {
    await withGlobalAgent(
      new https.Agent({ proxyEnv: { HTTPS_PROXY: "http://127.0.0.1:9" } }),
      async () => {
        const proxy = new ZenProxy(new LoggerNoop(), new AIStatistics());
        t.throws(
          () => proxy.start(false),
          /is not supported with NODE_USE_ENV_PROXY/
        );
        t.equal(proxy.isEnabled(), false);
      }
    );
  }
);

t.test(
  "it throws on Node.js versions without setGlobalProxyFromEnv",
  { skip: hasSetGlobalProxyFromEnv && "has setGlobalProxyFromEnv" },
  async (t) => {
    const proxy = new ZenProxy(new LoggerNoop(), new AIStatistics());
    t.throws(() => proxy.start(false), /requires Node.js v24.14.0 or newer/);
  }
);

t.test("it records ai_call lines into AI statistics", async (t) => {
  const stats = new AIStatistics();
  const proxy = new ZenProxy(new LoggerNoop(), stats);

  proxy.handleLine("not json");
  proxy.handleLine("[]");
  proxy.handleLine(JSON.stringify({ type: "unknown" }));
  proxy.handleLine(JSON.stringify({ type: "ai_call", provider: "openai" }));
  proxy.handleLine(
    JSON.stringify({
      type: "ai_call",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      input_tokens: 10,
      output_tokens: 5,
      cache_read_tokens: 3,
      cache_write_tokens: 2,
      tools_called: ["get_weather", "get_weather", 1],
    })
  );
  proxy.handleLine(
    JSON.stringify({
      type: "ai_call",
      provider: "openai",
      model: "gpt-4o-mini",
      input_tokens: "10",
      output_tokens: 5,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      tools_called: [],
    })
  );

  t.same(stats.getStats(), [
    {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      calls: 1,
      tokens: { input: 10, output: 5, total: 15, cacheRead: 3, cacheWrite: 2 },
      toolCalls: [{ name: "get_weather", calls: 2 }],
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      calls: 1,
      tokens: { input: 0, output: 5, total: 5, cacheRead: 0, cacheWrite: 0 },
    },
  ]);
});

t.test("it ignores invalid ready lines", async (t) => {
  const proxy = new ZenProxy(new LoggerNoop(), new AIStatistics());

  proxy.handleLine(JSON.stringify({ type: "ready", port: "1" }));
  t.equal(proxy.isEnabled(), false);
});

t.test(
  "it proxies only https on port 443 to known hosts once ready",
  { skip: !hasSetGlobalProxyFromEnv && "requires setGlobalProxyFromEnv" },
  async (t) => {
    const proxy = new ZenProxy(new LoggerNoop(), new AIStatistics());

    t.equal(proxy.shouldProxy("https://api.openai.com"), false);
    t.equal(proxy.getFetchDispatcher(), undefined);
    t.equal(proxy.getHttpsAgent(), undefined);

    proxy.handleLine(readyLine);

    t.equal(proxy.isEnabled(), true);
    t.ok(proxy.getFetchDispatcher());
    t.ok(proxy.getHttpsAgent());
    t.equal(proxy.shouldProxy("https://api.openai.com"), true);
    t.equal(proxy.shouldProxy(new URL("https://x.openai.azure.com:443")), true);
    t.equal(
      proxy.shouldProxy(new URL("https://api.anthropic.com/v1/messages")),
      true
    );
    t.equal(proxy.shouldProxy("http://api.openai.com"), false);
    t.equal(proxy.shouldProxy("https://api.openai.com:8443"), false);
    t.equal(proxy.shouldProxy("https://example.com"), false);
    t.equal(proxy.shouldProxy("not a url"), false);
    t.equal(proxy.shouldProxy(undefined), false);
  }
);
