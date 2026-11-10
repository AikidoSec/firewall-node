import * as t from "tap";
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
