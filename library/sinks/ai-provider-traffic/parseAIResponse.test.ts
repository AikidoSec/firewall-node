import * as t from "tap";
import type { AIWireFormat } from "./matchAIRequest";
import { parseAIResponseBody } from "./parseAIResponse";

const chatCompletion = {
  id: "chatcmpl-1",
  object: "chat.completion",
  model: "gpt-5-2025-08-07",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "get_weather", arguments: '{"city":"Ghent"}' },
          },
          {
            id: "call_2",
            type: "custom",
            custom: { name: "run_sql", input: "select 1" },
          },
        ],
      },
      finish_reason: "tool_calls",
    },
    {
      index: 1,
      message: {
        role: "assistant",
        function_call: { name: "get_time", arguments: "{}" },
      },
      finish_reason: "function_call",
    },
  ],
  usage: {
    prompt_tokens: 2000,
    completion_tokens: 10,
    total_tokens: 2010,
    prompt_tokens_details: { cached_tokens: 1024, cache_write_tokens: 512 },
  },
};

t.test("OpenAI Chat Completions", async (t) => {
  t.same(parseAIResponseBody({ type: "chat_completions" }, chatCompletion), {
    model: "gpt-5-2025-08-07",
    inputTokens: 2000,
    outputTokens: 10,
    cacheReadTokens: 1024,
    cacheWriteTokens: 512,
    toolNames: ["get_weather", "run_sql", "get_time"],
  });
});

t.test("OpenAI Responses", async (t) => {
  const response = {
    id: "resp_1",
    object: "response",
    model: "gpt-4.1-2025-04-14",
    output: [
      { type: "reasoning", summary: [] },
      {
        type: "function_call",
        call_id: "c1",
        name: "get_weather",
        arguments: "{}",
      },
      {
        type: "custom_tool_call",
        call_id: "c2",
        name: "run_sql",
        input: "select 1",
      },
      {
        type: "mcp_call",
        id: "m1",
        server_label: "docs",
        name: "search",
        arguments: "{}",
      },
      { type: "web_search_call", id: "w1", status: "completed" },
      { type: "message", content: [{ type: "output_text", text: "Hi" }] },
    ],
    usage: {
      input_tokens: 300,
      output_tokens: 40,
      input_tokens_details: { cached_tokens: 256, cache_write_tokens: 32 },
    },
  };

  t.same(parseAIResponseBody({ type: "responses" }, response), {
    model: "gpt-4.1-2025-04-14",
    inputTokens: 300,
    outputTokens: 40,
    cacheReadTokens: 256,
    cacheWriteTokens: 32,
    toolNames: ["get_weather", "run_sql", "search"],
  });
});

const anthropicMessage = {
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-4-5-20250929",
  content: [
    { type: "text", text: "Let me check." },
    {
      type: "tool_use",
      id: "toolu_1",
      name: "get_weather",
      input: { city: "Ghent" },
    },
    {
      type: "server_tool_use",
      id: "srvtoolu_1",
      name: "web_search",
      input: { query: "weather" },
    },
    { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [] },
    {
      type: "mcp_tool_use",
      id: "mcptoolu_1",
      name: "lookup",
      server_name: "docs",
      input: {},
    },
  ],
  stop_reason: "tool_use",
  usage: {
    input_tokens: 12,
    output_tokens: 34,
    cache_read_input_tokens: 1000,
    cache_creation_input_tokens: 200,
  },
};

t.test("Anthropic Messages", async (t) => {
  t.same(
    parseAIResponseBody({ type: "anthropic_messages" }, anthropicMessage),
    {
      model: "claude-sonnet-4-5-20250929",
      inputTokens: 12,
      outputTokens: 34,
      cacheReadTokens: 1000,
      cacheWriteTokens: 200,
      toolNames: ["get_weather", "web_search", "lookup"],
    }
  );
});

t.test("Gemini generateContent", async (t) => {
  const format: AIWireFormat = {
    type: "gemini_generate_content",
    pathModel: "gemini-2.5-pro",
  };
  const response = {
    candidates: [
      {
        content: {
          role: "model",
          parts: [
            { text: "Checking" },
            { functionCall: { name: "get_weather", args: { city: "Ghent" } } },
          ],
        },
        finishReason: "STOP",
      },
    ],
    usageMetadata: {
      promptTokenCount: 70,
      toolUsePromptTokenCount: 30,
      candidatesTokenCount: 8,
      thoughtsTokenCount: 500,
      cachedContentTokenCount: 32,
      totalTokenCount: 608,
    },
    modelVersion: "gemini-2.5-pro-001",
  };

  t.same(parseAIResponseBody(format, response), {
    model: "gemini-2.5-pro-001",
    inputTokens: 100,
    outputTokens: 508,
    cacheReadTokens: 32,
    cacheWriteTokens: 0,
    toolNames: ["get_weather"],
  });

  t.match(
    parseAIResponseBody(format, { ...response, modelVersion: undefined }),
    {
      model: "gemini-2.5-pro",
    }
  );
});

t.test("Gemini streamGenerateContent without ?alt=sse", async (t) => {
  const chunks = [
    {
      candidates: [{ content: { parts: [{ functionCall: { name: "a" } }] } }],
      usageMetadata: { promptTokenCount: 3 },
      modelVersion: "gemini-2.0-flash",
    },
    {
      candidates: [{ content: { parts: [{ functionCall: { name: "b" } }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
      modelVersion: "gemini-2.0-flash",
    },
  ];

  t.same(
    parseAIResponseBody(
      { type: "gemini_generate_content", pathModel: "gemini-2.0-flash" },
      chunks
    ),
    {
      model: "gemini-2.0-flash",
      inputTokens: 3,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolNames: ["a", "b"],
    }
  );
});

t.test("it ignores bodies without the expected shape or a model", async (t) => {
  t.equal(
    parseAIResponseBody(
      { type: "chat_completions" },
      { error: { message: "Rate limit" } }
    ),
    undefined
  );
  t.equal(
    parseAIResponseBody(
      { type: "chat_completions" },
      { ...chatCompletion, model: undefined }
    ),
    undefined
  );
  t.equal(
    parseAIResponseBody({ type: "anthropic_messages" }, "text"),
    undefined
  );
});
