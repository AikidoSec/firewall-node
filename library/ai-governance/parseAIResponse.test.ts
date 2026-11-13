import * as t from "tap";
import { parseAIResponse, type AICall } from "./parseAIResponse";

t.test(
  "it extracts model usage from inference responses on custom hosts",
  async (t) => {
    const cases: { path: string; body: unknown; expected: AICall }[] = [
      {
        path: "/proxy/v1/chat/completions",
        body: {
          model: "gpt-4o",
          choices: [{ message: { role: "assistant", content: "Hello" } }],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
          },
        },
        expected: {
          model: "gpt-4o",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/openai/deployments/gpt-4o/chat/completions?api-version=2024-10-21",
        body: {
          model: "gpt-4o-2024-08-06",
          choices: [{ message: { role: "assistant", content: "Hello" } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        },
        expected: {
          model: "gpt-4o-2024-08-06",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/proxy/v1/responses",
        body: {
          object: "response",
          model: "gpt-4o",
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "Hello" }],
            },
          ],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
        expected: {
          model: "gpt-4o",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/proxy/v1/messages",
        body: {
          type: "message",
          model: "claude-sonnet-4-20250514",
          content: [{ type: "text", text: "Hello" }],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
        expected: {
          model: "claude-sonnet-4-20250514",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/v1/projects/p/locations/us-east5/publishers/anthropic/models/claude-sonnet-4:rawPredict",
        body: {
          model: "claude-sonnet-4-20250514",
          content: [{ type: "text", text: "Hello" }],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
        expected: {
          model: "claude-sonnet-4-20250514",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/v1beta/models/gemini-2.5-flash:generateContent?key=secret",
        body: {
          modelVersion: "gemini-2.5-flash",
          candidates: [
            { content: { role: "model", parts: [{ text: "Hello" }] } },
          ],
          usageMetadata: {
            promptTokenCount: 98,
            toolUsePromptTokenCount: 2,
            candidatesTokenCount: 15,
            thoughtsTokenCount: 5,
          },
        },
        expected: {
          model: "gemini-2.5-flash",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/v1/projects/p/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent",
        body: {
          candidates: [
            { content: { role: "model", parts: [{ text: "Hello" }] } },
          ],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20 },
        },
        expected: {
          model: "gemini-2.5-flash",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/model/us.anthropic.claude-sonnet-4-20250514-v1%3A0/converse",
        body: {
          output: {
            message: { role: "assistant", content: [{ text: "Hello" }] },
          },
          usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        },
        expected: {
          model: "us.anthropic.claude-sonnet-4-20250514-v1:0",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
      {
        path: "/model/anthropic.claude-sonnet-4-20250514-v1%3A0/invoke",
        body: {
          model: "claude-sonnet-4-20250514",
          content: [{ type: "text", text: "Hello" }],
          usage: { input_tokens: 100, output_tokens: 20 },
        },
        expected: {
          model: "anthropic.claude-sonnet-4-20250514-v1:0",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      },
    ];
    for (const { path, body, expected } of cases) {
      t.same(
        parseAIResponse(new URL(path, "https://gateway.internal"), body),
        expected,
        path
      );
    }
  }
);

t.test("it ignores inherited model and usage fields", async (t) => {
  const paths = [
    "/v1/chat/completions",
    "/v1/responses",
    "/v1/messages",
    "/models/gemini-from-path:generateContent",
    "/model/bedrock-from-path/converse",
    "/model/bedrock-from-path/invoke",
  ];
  const polluted = {
    model: "inherited-model",
    modelVersion: "inherited-version",
    usage: { prompt_tokens: 999, input_tokens: 999, inputTokens: 999 },
    usageMetadata: { promptTokenCount: 999 },
    prompt_tokens: 999,
    completion_tokens: 999,
    input_tokens: 999,
    output_tokens: 999,
    inputTokens: 999,
    outputTokens: 999,
    promptTokenCount: 999,
    toolUsePromptTokenCount: 999,
    candidatesTokenCount: 999,
    thoughtsTokenCount: 999,
  };
  const descriptors = Object.getOwnPropertyDescriptors(Object.prototype);
  try {
    for (const [key, value] of Object.entries(polluted)) {
      Object.defineProperty(Object.prototype, key, {
        value,
        configurable: true,
        writable: true,
        enumerable: true,
      });
    }
    for (const path of paths) {
      const url = new URL(path, "https://gateway.internal");
      const model = path.includes("gemini")
        ? "gemini-from-path"
        : path.includes("bedrock")
          ? "bedrock-from-path"
          : "own-model";
      t.same(
        parseAIResponse(url, JSON.parse('{"model":"own-model"}')),
        {
          model,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        path
      );
      t.same(
        parseAIResponse(
          url,
          JSON.parse('{"model":"own-model","usage":{},"usageMetadata":{}}')
        ),
        {
          model,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
        path
      );
      if (!path.includes("gemini") && !path.includes("bedrock")) {
        t.equal(parseAIResponse(url, JSON.parse("{}")), undefined, path);
      }
    }
  } finally {
    for (const key of Object.keys(polluted)) {
      const descriptor = Object.prototype.hasOwnProperty.call(descriptors, key)
        ? descriptors[key]
        : undefined;
      if (descriptor) {
        Object.defineProperty(Object.prototype, key, descriptor);
      } else {
        delete (Object.prototype as Record<string, unknown>)[key];
      }
    }
  }
});

t.test(
  "it records model-only responses without requiring the full response shape",
  async (t) => {
    const url = new URL("https://gateway.internal/v1/responses");
    t.same(parseAIResponse(url, { model: "gpt-4o" }), {
      model: "gpt-4o",
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    t.same(
      parseAIResponse(url, {
        model: "gpt-4o",
        usage: { input_tokens: -1, output_tokens: "20" },
      }),
      {
        model: "gpt-4o",
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }
    );
    t.equal(
      parseAIResponse(url, { error: { message: "Rate limit exceeded" } }),
      undefined
    );
    t.equal(
      parseAIResponse(new URL("https://gateway.internal/v1/embeddings"), {
        model: "text-embedding-3-small",
      }),
      undefined
    );
  }
);

t.test("it extracts cached tokens", async (t) => {
  t.same(
    parseAIResponse(new URL("https://api.openai.com/v1/responses"), {
      model: "gpt-4o",
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 40, cache_write_tokens: 7 },
      },
    }),
    {
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 20,
      cacheReadTokens: 40,
      cacheWriteTokens: 7,
    }
  );
  t.same(
    parseAIResponse(new URL("https://api.anthropic.com/v1/messages"), {
      model: "claude",
      usage: {
        input_tokens: 1,
        output_tokens: 2,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 4,
      },
    }),
    {
      model: "claude",
      inputTokens: 1,
      outputTokens: 2,
      cacheReadTokens: 3,
      cacheWriteTokens: 4,
    }
  );
});
