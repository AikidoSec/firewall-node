import * as t from "tap";
import { setTimeout } from "timers/promises";
import * as zlib from "zlib";
import { brotliCompressSync, deflateSync, gzipSync } from "zlib";
import { createAIResponseParser } from "./AIResponseParser";
import type { AICall } from "./parseAIResponse";

const body = Buffer.from(
  JSON.stringify({
    model: "gpt-4o",
    choices: [{ message: { role: "assistant", content: "Hi 👋" } }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  })
);
const expected = {
  model: "gpt-4o",
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};
const url = new URL("https://gateway.internal/v1/chat/completions");

function parser(onCall: (call: AICall) => void, contentEncoding?: string) {
  return createAIResponseParser({
    url,
    contentType: "application/json; charset=utf-8",
    contentEncoding,
    onCall,
  })!;
}

t.test(
  "it collects split JSON without retaining the app's buffers",
  async (t) => {
    const calls: AICall[] = [];
    const response = parser((call) => calls.push(call));
    const split = body.indexOf(Buffer.from("👋")) + 2;
    const first = Buffer.from(body.subarray(0, split));
    response.write(first);
    first.fill(0);
    response.write(body.subarray(split));
    response.end();
    t.same(calls, [expected]);
  }
);

t.test(
  "it decodes compressed JSON without changing the response bytes",
  async (t) => {
    for (const [encoding, compress] of [
      ["gzip", gzipSync],
      ["deflate", deflateSync],
      ["br", brotliCompressSync],
    ] as const) {
      const encoded = compress(body);
      const original = Buffer.from(encoded);
      const call = await new Promise<AICall>((resolve) => {
        const response = parser(resolve, encoding);
        response.write(encoded);
        response.end();
      });
      t.same(call, expected, encoding);
      t.same(encoded, original, encoding);
    }
  }
);

t.test("it handles zstd depending on Node.js support", async (t) => {
  if (typeof zlib.zstdCompressSync !== "function") {
    t.equal(
      createAIResponseParser({
        url,
        contentType: "application/json",
        contentEncoding: "zstd",
        onCall: () => {},
      }),
      undefined,
      "unsupported on this Node.js version"
    );
    return;
  }
  const encoded = zlib.zstdCompressSync(body);
  const original = Buffer.from(encoded);
  const call = await new Promise<AICall>((resolve) => {
    const response = parser(resolve, "zstd");
    response.write(encoded);
    response.end();
  });
  t.same(call, expected);
  t.same(encoded, original);
});

t.test("it discards incomplete, invalid and oversized responses", async (t) => {
  for (const text of [
    '{"model":"gpt-4o",',
    JSON.stringify({ model: "gpt-4o", output: "a".repeat(2 * 1024 * 1024) }),
  ]) {
    const calls: AICall[] = [];
    const response = parser((call) => calls.push(call));
    const bytes = Buffer.from(text);
    for (let i = 0; i < bytes.length; i += 64 * 1024) {
      response.write(bytes.subarray(i, i + 64 * 1024));
    }
    response.end();
    t.same(calls, []);
  }
  const calls: AICall[] = [];
  const response = parser((call) => calls.push(call));
  response.write(body);
  response.destroy();
  response.end();
  t.same(calls, [], "aborted response");
});

t.test("it only creates a parser for JSON responses on AI paths", async (t) => {
  const create = (
    overrides: Partial<Parameters<typeof createAIResponseParser>[0]>
  ) =>
    createAIResponseParser({
      url,
      contentType: "application/json",
      contentEncoding: undefined,
      onCall: () => {},
      ...overrides,
    });

  t.ok(create({}), "application/json");
  t.ok(
    create({ contentType: "Application/JSON; charset=utf-8" }),
    "mixed case"
  );
  t.ok(create({ contentType: "application/problem+json" }), "+json suffix");
  t.ok(create({ contentEncoding: " GZIP " }), "case and whitespace");
  t.ok(create({ contentEncoding: "identity" }), "identity");
  t.ok(
    create({ url: new URL("https://gateway.internal/proxy/v1/responses") }),
    "prefixed path"
  );
  t.equal(create({ contentType: undefined }), undefined, "no content type");
  t.equal(create({ contentType: "text/event-stream" }), undefined, "SSE");
  t.equal(create({ contentType: "text/html" }), undefined, "html");
  t.equal(create({ contentEncoding: "compress" }), undefined, "unknown");
  t.equal(create({ contentEncoding: "gzip, br" }), undefined, "stacked");
  t.equal(
    create({ url: new URL("https://example.com/api/users") }),
    undefined,
    "non-AI path"
  );
});

t.test("it decodes compressed JSON delivered in small chunks", async (t) => {
  const encoded = gzipSync(body);
  const call = await new Promise<AICall>((resolve) => {
    const response = parser(resolve, "gzip");
    for (let i = 0; i < encoded.length; i += 7) {
      response.write(encoded.subarray(i, i + 7));
    }
    response.end();
  });
  t.same(call, expected);
});

t.test("it discards corrupt or truncated compressed data", async (t) => {
  const valid = gzipSync(body);
  for (const [name, data] of [
    ["garbage", Buffer.from("not gzip at all")],
    ["truncated", valid.subarray(0, valid.length - 10)],
  ] as const) {
    const calls: AICall[] = [];
    const response = parser((call) => calls.push(call), "gzip");
    response.write(data);
    response.end();
    await setTimeout(20);
    t.same(calls, [], name);
  }
});

t.test("it discards decompression bombs", async (t) => {
  const bomb = gzipSync(
    Buffer.from(
      JSON.stringify({ model: "gpt-4o", output: "a".repeat(10 * 1024 * 1024) })
    )
  );
  t.ok(bomb.length < 2 * 1024 * 1024, "compressed form is under the limit");
  const calls: AICall[] = [];
  const response = parser((call) => calls.push(call), "gzip");
  response.write(bomb);
  response.end();
  await setTimeout(50);
  t.same(calls, []);
});

t.test("it ignores writes after end or destroy", async (t) => {
  const calls: AICall[] = [];
  const response = parser((call) => calls.push(call));
  response.write(body);
  response.end();
  response.write(body);
  response.end();
  t.equal(calls.length, 1, "reports once");

  const other: AICall[] = [];
  const destroyed = parser((call) => other.push(call));
  destroyed.destroy();
  destroyed.write(body);
  destroyed.end();
  t.same(other, []);
});

t.test("it ignores JSON without a usable AI response", async (t) => {
  const calls: AICall[] = [];
  const response = parser((call) => calls.push(call));
  response.write(Buffer.from(JSON.stringify({ hello: "world" })));
  response.end();
  t.same(calls, []);
});

t.test("it does not throw when the callback throws", async (t) => {
  const response = parser(() => {
    throw new Error("boom");
  });
  response.write(body);
  t.doesNotThrow(() => response.end());
});
