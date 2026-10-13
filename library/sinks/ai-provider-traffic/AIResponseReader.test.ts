import * as t from "tap";
import { brotliCompressSync, gzipSync } from "zlib";
import { createAIResponseReader, maxAIResponseSize } from "./AIResponseReader";
import type { AIWireFormat } from "./matchAIRequest";
import type { AICall } from "./parseAIResponse";

async function read(
  format: AIWireFormat,
  body: string | Buffer,
  {
    contentType = "text/event-stream",
    contentEncoding,
    chunkSize = 7,
  }: { contentType?: string; contentEncoding?: string; chunkSize?: number } = {}
): Promise<AICall | undefined> {
  const reader = createAIResponseReader(format, contentType, contentEncoding);
  if (!reader) {
    throw new Error("Unsupported content-encoding");
  }

  // Small chunks, so that lines are split across chunks
  const bytes = Buffer.from(body);
  for (let start = 0; start < bytes.length; start += chunkSize) {
    reader.write(bytes.subarray(start, start + chunkSize));
  }

  return await reader.end();
}

function data(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const anthropicStream = [
  { type: "ping" },
  {
    type: "message_start",
    message: {
      id: "msg_1",
      model: "claude-haiku-4-5",
      content: [],
      usage: {
        input_tokens: 25,
        output_tokens: 1,
        cache_read_input_tokens: 500,
        cache_creation_input_tokens: 0,
      },
    },
  },
  {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  },
  {
    type: "content_block_start",
    index: 1,
    content_block: {
      type: "tool_use",
      id: "toolu_1",
      name: "search_docs",
      input: {},
    },
  },
  {
    type: "message_delta",
    delta: { stop_reason: "tool_use" },
    usage: { output_tokens: 15 },
  },
  {
    type: "message_delta",
    delta: {},
    usage: {
      input_tokens: 26,
      output_tokens: 42,
      cache_creation_input_tokens: 7,
    },
  },
  { type: "message_stop" },
]
  .map((event) => `event: ${event.type}\n${data(event)}`)
  .join("");

const anthropicCall: AICall = {
  model: "claude-haiku-4-5",
  inputTokens: 26,
  outputTokens: 42,
  cacheReadTokens: 500,
  cacheWriteTokens: 7,
  toolNames: ["search_docs"],
};

t.test("OpenAI Chat Completions stream", async (t) => {
  const format: AIWireFormat = { type: "chat_completions" };
  const toolCalls = [
    data({ id: "x", model: "", choices: [], prompt_filter_results: [] }),
    data({
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "c1",
                type: "function",
                function: { name: "lookup", arguments: "" },
              },
            ],
          },
        },
      ],
      usage: null,
    }),
    data({
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, function: { name: "lookup", arguments: "{}" } },
            ],
          },
        },
      ],
      usage: null,
    }),
    data({
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 1,
                id: "c2",
                type: "function",
                function: { name: "search", arguments: "{}" },
              },
            ],
          },
        },
      ],
      usage: null,
    }),
    data({
      model: "gpt-4o",
      choices: [],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 16 },
      },
    }),
    "data: [DONE]\n\n",
  ].join("");

  t.same(await read(format, toolCalls), {
    model: "gpt-4o",
    inputTokens: 50,
    outputTokens: 20,
    cacheReadTokens: 16,
    cacheWriteTokens: 0,
    toolNames: ["lookup", "search"],
  });

  const legacyFunctionCallWithoutUsage = [
    data({
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          delta: { function_call: { name: "get_weather", arguments: "" } },
        },
      ],
    }),
    data({
      model: "gpt-4o",
      choices: [{ index: 0, delta: { function_call: { arguments: "{}" } } }],
    }),
    "data: [DONE]\n\n",
  ].join("");

  t.same(await read(format, legacyFunctionCallWithoutUsage), {
    model: "gpt-4o",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolNames: ["get_weather"],
  });
});

t.test("OpenAI Responses stream", async (t) => {
  const format: AIWireFormat = { type: "responses" };
  const stream = [
    {
      type: "response.created",
      response: { model: "gpt-4.1", output: [], usage: null },
    },
    {
      type: "response.output_item.added",
      item: { type: "function_call", name: "get_weather" },
    },
    {
      type: "response.completed",
      response: {
        model: "gpt-4.1",
        output: [
          { type: "function_call", name: "get_weather", arguments: "{}" },
        ],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          input_tokens_details: { cached_tokens: 0 },
        },
      },
    },
  ]
    .map((event) => `event: ${event.type}\n${data(event)}`)
    .join("");

  t.same(await read(format, stream), {
    model: "gpt-4.1",
    inputTokens: 10,
    outputTokens: 5,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    toolNames: ["get_weather"],
  });

  t.equal(
    await read(format, stream.split("event: response.completed")[0]),
    undefined
  );
});

t.test("Anthropic Messages stream", async (t) => {
  t.same(
    await read({ type: "anthropic_messages" }, anthropicStream),
    anthropicCall
  );
});

t.test("Gemini streamGenerateContent with ?alt=sse", async (t) => {
  const stream = [
    {
      candidates: [{ content: { parts: [{ functionCall: { name: "a" } }] } }],
      usageMetadata: { promptTokenCount: 5 },
    },
    {
      candidates: [{ content: { parts: [{ functionCall: { name: "b" } }] } }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 9 },
    },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\r\n\r\n`)
    .join("");

  t.same(
    await read(
      { type: "gemini_generate_content", pathModel: "gemini-2.0-flash" },
      stream
    ),
    {
      model: "gemini-2.0-flash",
      inputTokens: 5,
      outputTokens: 9,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolNames: ["a", "b"],
    }
  );
});

t.test("it decompresses streams and JSON bodies", async (t) => {
  t.same(
    await read({ type: "anthropic_messages" }, gzipSync(anthropicStream), {
      contentEncoding: "gzip",
    }),
    anthropicCall
  );

  const message = JSON.stringify({
    type: "message",
    model: "claude-opus-4-1",
    content: [],
    usage: { input_tokens: 3, output_tokens: 4 },
  });
  const json = { contentType: "application/json" };
  t.match(
    await read({ type: "anthropic_messages" }, gzipSync(message), {
      ...json,
      contentEncoding: "gzip",
    }),
    { model: "claude-opus-4-1", inputTokens: 3, outputTokens: 4 }
  );
  t.match(
    await read({ type: "anthropic_messages" }, brotliCompressSync(message), {
      ...json,
      contentEncoding: "br",
    }),
    { model: "claude-opus-4-1", inputTokens: 3, outputTokens: 4 }
  );

  t.equal(
    createAIResponseReader({ type: "chat_completions" }, undefined, "zstd"),
    undefined
  );
});

t.test("it parses streams larger than the size limit", async (t) => {
  const delta = data({
    model: "gpt-5",
    choices: [{ index: 0, delta: { content: "x".repeat(200) } }],
  });
  const stream =
    delta.repeat(Math.ceil(maxAIResponseSize / delta.length) + 1) +
    data({
      model: "gpt-5",
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 40000 },
    });

  t.match(
    await read({ type: "chat_completions" }, stream, { chunkSize: 65536 }),
    { model: "gpt-5", inputTokens: 10, outputTokens: 40000 }
  );
});

t.test("it stops decompressing JSON above the size limit", async (t) => {
  const bomb = gzipSync(Buffer.alloc(maxAIResponseSize + 1, " "));

  t.equal(
    await read({ type: "chat_completions" }, bomb, {
      contentType: "application/json",
      contentEncoding: "gzip",
      chunkSize: 65536,
    }),
    undefined
  );
});
