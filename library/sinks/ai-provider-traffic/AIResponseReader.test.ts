import * as t from "tap";
import { brotliCompressSync, deflateSync, gzipSync } from "zlib";
import { createAIResponseReader, maxAIResponseSize } from "./AIResponseReader";
import type { AIWireFormat } from "./matchAIRequest";
import type { AICall } from "./parseAIResponse";

const formats: { format: AIWireFormat; body: unknown; name: string }[] = [
  {
    format: { type: "chat_completions" },
    body: {
      id: "chat-1",
      model: "test-model",
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: "weather" } },
              { function: { name: "weather" } },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 4 },
    },
    name: "weather",
  },
  {
    format: { type: "responses" },
    body: {
      id: "response-1",
      model: "test-model",
      output: [
        { type: "function_call", name: "weather" },
        { type: "function_call", name: "weather" },
      ],
      usage: { input_tokens: 10, output_tokens: 4 },
    },
    name: "weather",
  },
  {
    format: { type: "anthropic_messages" },
    body: {
      id: "message-1",
      model: "test-model",
      content: [
        { type: "tool_use", name: "weather" },
        { type: "server_tool_use", name: "weather" },
      ],
      usage: { input_tokens: 10, output_tokens: 4 },
    },
    name: "weather",
  },
  {
    format: { type: "gemini_generate_content", pathModel: "test-model" },
    body: {
      responseId: "gemini-1",
      candidates: [
        {
          content: {
            parts: [
              { functionCall: { name: "weather" } },
              { functionCall: { name: "weather" } },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 3,
        thoughtsTokenCount: 1,
      },
    },
    name: "weather",
  },
];

t.test(
  "captures JSON tool calls across chunk boundaries and content encodings",
  async (t) => {
    const encodings = [
      { name: "identity", encode: (body: Buffer) => body },
      { name: "gzip", encode: gzipSync },
      { name: "deflate", encode: deflateSync },
      { name: "br", encode: brotliCompressSync },
    ];
    for (const { format, body, name } of formats) {
      for (const encoding of encodings) {
        const call = await new Promise<AICall | undefined>((resolve) => {
          const reader = createAIResponseReader(
            format,
            "application/json",
            encoding.name,
            resolve
          )!;
          const bytes = encoding.encode(Buffer.from(JSON.stringify(body)));
          for (let offset = 0; offset < bytes.length; offset += 7) {
            reader.write(bytes.subarray(offset, offset + 7));
          }
          reader.end();
        });
        t.match(
          call,
          {
            model: "test-model",
            inputTokens: 10,
            outputTokens: 4,
            toolNames: [name, name],
          },
          `${format.type}/${encoding.name}`
        );
      }
    }
  }
);

t.test(
  "counts streamed calls once, including repeated names, split UTF-8, and multiline SSE",
  async (t) => {
    const events = [
      {
        id: "chat-stream",
        model: "test-model",
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: 0, function: { name: "wea" } },
                { index: 1, function: { name: "weather" } },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            index: 0,
            delta: {
              content: "🌤",
              tool_calls: [
                { index: 0, function: { name: "ther", arguments: "{}" } },
              ],
            },
          },
        ],
      },
      { choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } },
    ];
    const body = Buffer.from(
      `: keepalive\r\n\r\ndata: malformed\n\n${events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join("")}data: [DONE]\n\n`
    );
    let call: AICall | undefined;
    const reader = createAIResponseReader(
      { type: "chat_completions" },
      "text/event-stream",
      undefined,
      (result) => {
        call = result;
      }
    )!;
    for (const byte of body) reader.write(Buffer.from([byte]));
    reader.end();
    t.match(call, {
      toolNames: ["weather", "weather"],
      inputTokens: 10,
      outputTokens: 4,
    });

    let multiline: AICall | undefined;
    const other = createAIResponseReader(
      { type: "responses" },
      "text/event-stream",
      undefined,
      (result) => {
        multiline = result;
      }
    )!;
    other.write(
      Buffer.from(
        'data: {"type":"response.completed",\ndata: "response":{"id":"r1","model":"test-model","output":[{"type":"function_call","name":"weather"}]}}\n\n'
      )
    );
    other.end();
    for (const [format, events] of [
      [
        { type: "responses" },
        [
          {
            type: "response.output_item.done",
            item: { type: "function_call", id: "f1", name: "weather" },
          },
          {
            type: "response.completed",
            response: {
              id: "r2",
              model: "test-model",
              output: [
                { type: "function_call", name: "weather" },
                { type: "function_call", name: "weather" },
              ],
              usage: { input_tokens: 10, output_tokens: 4 },
            },
          },
        ],
      ],
      [
        { type: "anthropic_messages" },
        [
          {
            type: "message_start",
            message: {
              id: "a1",
              model: "test-model",
              usage: { input_tokens: 10, output_tokens: 1 },
            },
          },
          {
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", name: "weather" },
          },
          {
            type: "content_block_start",
            index: 1,
            content_block: { type: "tool_use", name: "weather" },
          },
          { type: "message_delta", usage: { output_tokens: 4 } },
        ],
      ],
      [
        { type: "gemini_generate_content", pathModel: "test-model" },
        [formats[3].body],
      ],
    ] as [AIWireFormat, unknown[]][]) {
      const call = await new Promise<AICall | undefined>((resolve) => {
        const reader = createAIResponseReader(
          format,
          "text/event-stream",
          "gzip",
          resolve
        )!;
        reader.write(
          gzipSync(
            events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
          )
        );
        reader.end();
      });
      t.match(
        call,
        {
          model: "test-model",
          inputTokens: 10,
          outputTokens: 4,
          toolNames: ["weather", "weather"],
        },
        format.type
      );
    }
    t.match(multiline, { toolNames: ["weather"] });
  }
);

t.test(
  "does not report malformed, oversized, unsupported, or aborted bodies",
  async (t) => {
    for (const body of [
      Buffer.from("not json"),
      Buffer.alloc(maxAIResponseSize + 1, 32),
    ]) {
      let call: AICall | undefined;
      const reader = createAIResponseReader(
        { type: "responses" },
        "application/json",
        undefined,
        (result) => {
          call = result;
        }
      )!;
      reader.write(body);
      reader.end();
      t.equal(call, undefined);
    }
    const reader = createAIResponseReader(
      { type: "chat_completions" },
      "application/json",
      undefined,
      (call) => {
        if (call) t.fail("aborted body reported");
      }
    )!;
    reader.write(Buffer.from(JSON.stringify(formats[0].body)));
    reader.destroy();
    reader.end();
    t.equal(
      createAIResponseReader(
        { type: "responses" },
        "text/html",
        undefined,
        () => {}
      ),
      undefined
    );
    t.equal(
      createAIResponseReader(
        { type: "responses" },
        "application/json",
        "unknown",
        () => {}
      ),
      undefined
    );

    for (const tail of [
      "data: " + " ".repeat(1024 * 1024 + 1) + "\n\n",
      "data: " + " ".repeat(1024 * 1024 + 1),
    ]) {
      let call: AICall | undefined;
      const reader = createAIResponseReader(
        { type: "chat_completions" },
        "text/event-stream",
        undefined,
        (result) => {
          call = result;
        }
      )!;
      reader.write(Buffer.from('data: {"model":"test-model"}\n\n' + tail));
      reader.end();
      t.equal(
        call,
        undefined,
        "oversized SSE event is discarded even with a newline"
      );
    }
    const mutable = Buffer.from(JSON.stringify(formats[0].body));
    const copied = await new Promise<AICall | undefined>((resolve) => {
      const reader = createAIResponseReader(
        { type: "chat_completions" },
        "application/json",
        "gzip",
        resolve
      )!;
      const compressed = gzipSync(mutable);
      reader.write(compressed);
      compressed.fill(0);
      reader.end();
    });
    t.match(
      copied,
      { toolNames: ["weather", "weather"] },
      "decompression owns its input copy"
    );
    const invalidGzip = await new Promise<AICall | undefined>((resolve) => {
      const compressed = createAIResponseReader(
        { type: "responses" },
        "application/json",
        "gzip",
        resolve
      )!;
      compressed.write(Buffer.from("not gzip"));
      compressed.end();
    });
    t.equal(invalidGzip, undefined);
  }
);
