import * as t from "tap";
import { createTestAgent } from "../helpers/createTestAgent";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";
import { isEsmUnitTest } from "../helpers/isEsmUnitTest";
import { startTestAgent } from "../helpers/startTestAgent";
import { AiProxyClients } from "./AiProxyClients";

// createZenFetch() returns a named `zenFetch` function -- checking the name
// lets us tell "the sink pinned this" apart from "the SDK's own default
// fetch" without mocking the proxy or making any network call.
function isPinned(fetchFn: unknown): boolean {
  return typeof fetchFn === "function" && fetchFn.name === "zenFetch";
}

// Both SDKs throw from their constructor when given no `fetch` and no
// global `fetch` exists; Node only ships one unflagged since 18.
const skipWithoutGlobalFetch =
  getMajorNodeVersion() < 18 ? "requires a global fetch (Node 18+)" : undefined;

// Both SDKs' package.json points bare `import` at a real ESM build
// (index.mjs/client.mjs, `export class` bindings) instead of the CJS one
// (index.js/client.js) our file-instrumentation patches -- pinning only
// takes effect there, so it doesn't apply when a caller imports the ESM
// build directly. Fails open the same as an unhealthy proxy would.
const skipUnderEsm = isEsmUnitTest()
  ? "pinning targets the CJS build only"
  : undefined;

t.test(
  "pins openai clients with no fetch of their own",
  {
    skip: skipWithoutGlobalFetch ?? skipUnderEsm,
  },
  async (t) => {
    const originalToken = process.env.AIKIDO_TOKEN;
    process.env.AIKIDO_TOKEN = "test-token";
    try {
      startTestAgent({
        wrappers: [new AiProxyClients()],
        rewrite: { openai: "openai-v7" },
      });

      const { OpenAI } = require("openai-v7") as typeof import("openai-v7");
      const client = new OpenAI({ apiKey: "fake" }) as any;

      t.ok(isPinned(client.fetch));
    } finally {
      process.env.AIKIDO_TOKEN = originalToken;
    }
  }
);

t.test(
  "pins anthropic clients with no fetch of their own",
  {
    skip: skipWithoutGlobalFetch ?? skipUnderEsm,
  },
  async (t) => {
    const originalToken = process.env.AIKIDO_TOKEN;
    process.env.AIKIDO_TOKEN = "test-token";
    try {
      const agent = createTestAgent();
      agent.start([new AiProxyClients()]);

      let Anthropic: any = require("@anthropic-ai/sdk");
      if (isEsmUnitTest()) {
        // in ESM the default export is the Anthropic factory
        Anthropic = Anthropic.default;
      }
      const client = new Anthropic({ apiKey: "fake" });

      t.ok(isPinned(client.fetch));
    } finally {
      process.env.AIKIDO_TOKEN = originalToken;
    }
  }
);

t.test("leaves a caller-supplied fetch untouched", async (t) => {
  const originalToken = process.env.AIKIDO_TOKEN;
  process.env.AIKIDO_TOKEN = "test-token";
  try {
    startTestAgent({
      wrappers: [new AiProxyClients()],
      rewrite: { openai: "openai-v7" },
    });

    const { OpenAI } = require("openai-v7") as typeof import("openai-v7");
    const ownFetch = async () => new Response("own fetch");
    const client = new OpenAI({ apiKey: "fake", fetch: ownFetch }) as any;

    t.equal(client.fetch, ownFetch);
  } finally {
    process.env.AIKIDO_TOKEN = originalToken;
  }
});

t.test(
  "does not pin without an AIKIDO_TOKEN",
  {
    skip: skipWithoutGlobalFetch,
  },
  async (t) => {
    const originalToken = process.env.AIKIDO_TOKEN;
    delete process.env.AIKIDO_TOKEN;
    try {
      startTestAgent({
        wrappers: [new AiProxyClients()],
        rewrite: { openai: "openai-v7" },
      });

      const { OpenAI } = require("openai-v7") as typeof import("openai-v7");
      const client = new OpenAI({ apiKey: "fake" }) as any;

      t.notOk(isPinned(client.fetch));
    } finally {
      process.env.AIKIDO_TOKEN = originalToken;
    }
  }
);
