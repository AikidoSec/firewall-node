import { brotliDecompress, gunzip, inflate } from "zlib";
import { isPlainObject } from "../../helpers/isPlainObject";
import type { AIWireFormat } from "./matchAIRequest";

export type AICall = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolNames: string[];
};

export const maxAIResponseSize = 8 * 1024 * 1024;

export async function parseAIResponse(
  format: AIWireFormat,
  contentEncoding: string | undefined,
  body: Buffer
): Promise<AICall | undefined> {
  const decoded = await decodeBody(contentEncoding, body);
  if (!decoded) {
    return undefined;
  }

  let json: unknown;
  try {
    json = JSON.parse(decoded.toString("utf8"));
  } catch {
    return undefined;
  }

  const call = parseBody(format, json);
  if (!call || !call.model) {
    return undefined;
  }

  return call;
}

function decodeBody(
  contentEncoding: string | undefined,
  body: Buffer
): Promise<Buffer | undefined> {
  return new Promise((resolve) => {
    const options = { maxOutputLength: maxAIResponseSize };
    const callback = (error: Error | null, result: Buffer) => {
      resolve(error ? undefined : result);
    };

    switch (contentEncoding) {
      case undefined:
      case "":
      case "identity":
        return resolve(body);
      case "gzip":
      case "x-gzip":
        return gunzip(body, options, callback);
      case "deflate":
        return inflate(body, options, callback);
      case "br":
        return brotliDecompress(body, options, callback);
      default:
        return resolve(undefined);
    }
  });
}

function parseBody(format: AIWireFormat, body: unknown): AICall | undefined {
  switch (format.type) {
    case "chat_completions":
      return parseChatCompletions(body);
    case "responses":
      return parseResponses(body);
    case "anthropic_messages":
      return parseAnthropicMessages(body);
    case "gemini_generate_content":
      return parseGeminiGenerateContent(body, format.pathModel);
  }
}

function parseChatCompletions(body: unknown): AICall | undefined {
  const choices = get(body, "choices");
  if (!Array.isArray(choices)) {
    return undefined;
  }

  const toolNames: string[] = [];
  for (const choice of choices) {
    for (const toolCall of getArray(get(choice, "message", "tool_calls"))) {
      addToolName(
        toolNames,
        getString(get(toolCall, "function", "name")) ??
          get(toolCall, "custom", "name")
      );
    }
    addToolName(toolNames, get(choice, "message", "function_call", "name"));
  }

  const usage = get(body, "usage");

  return {
    model: getString(get(body, "model")) ?? "",
    inputTokens: getTokens(get(usage, "prompt_tokens")),
    outputTokens: getTokens(get(usage, "completion_tokens")),
    cacheReadTokens: getTokens(
      get(usage, "prompt_tokens_details", "cached_tokens")
    ),
    cacheWriteTokens: getTokens(
      get(usage, "prompt_tokens_details", "cache_write_tokens")
    ),
    toolNames,
  };
}

function parseResponses(body: unknown): AICall | undefined {
  const output = get(body, "output");
  if (!Array.isArray(output)) {
    return undefined;
  }

  const toolNames: string[] = [];
  for (const item of output) {
    const type = get(item, "type");
    if (
      type === "function_call" ||
      type === "custom_tool_call" ||
      type === "mcp_call"
    ) {
      addToolName(toolNames, get(item, "name"));
    }
  }

  const usage = get(body, "usage");

  return {
    model: getString(get(body, "model")) ?? "",
    inputTokens: getTokens(get(usage, "input_tokens")),
    outputTokens: getTokens(get(usage, "output_tokens")),
    cacheReadTokens: getTokens(
      get(usage, "input_tokens_details", "cached_tokens")
    ),
    cacheWriteTokens: getTokens(
      get(usage, "input_tokens_details", "cache_write_tokens")
    ),
    toolNames,
  };
}

function parseAnthropicMessages(body: unknown): AICall | undefined {
  const content = get(body, "content");
  if (!Array.isArray(content)) {
    return undefined;
  }

  const toolNames: string[] = [];
  for (const block of content) {
    const type = get(block, "type");
    if (
      type === "tool_use" ||
      type === "server_tool_use" ||
      type === "mcp_tool_use"
    ) {
      addToolName(toolNames, get(block, "name"));
    }
  }

  const usage = get(body, "usage");

  return {
    model: getString(get(body, "model")) ?? "",
    inputTokens: getTokens(get(usage, "input_tokens")),
    outputTokens: getTokens(get(usage, "output_tokens")),
    cacheReadTokens: getTokens(get(usage, "cache_read_input_tokens")),
    cacheWriteTokens: getTokens(get(usage, "cache_creation_input_tokens")),
    toolNames,
  };
}

function parseGeminiGenerateContent(
  body: unknown,
  pathModel: string
): AICall | undefined {
  const candidates = get(body, "candidates");
  const usage = get(body, "usageMetadata");
  if (candidates === undefined && usage === undefined) {
    return undefined;
  }

  const toolNames: string[] = [];
  for (const candidate of getArray(candidates)) {
    for (const part of getArray(get(candidate, "content", "parts"))) {
      addToolName(toolNames, get(part, "functionCall", "name"));
    }
  }

  return {
    model: getString(get(body, "modelVersion")) ?? pathModel,
    // promptTokenCount already includes the cached tokens
    inputTokens:
      getTokens(get(usage, "promptTokenCount")) +
      getTokens(get(usage, "toolUsePromptTokenCount")),
    outputTokens:
      getTokens(get(usage, "candidatesTokenCount")) +
      getTokens(get(usage, "thoughtsTokenCount")),
    cacheReadTokens: getTokens(get(usage, "cachedContentTokenCount")),
    cacheWriteTokens: 0,
    toolNames,
  };
}

function get(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function getArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getTokens(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

function addToolName(toolNames: string[], name: unknown): void {
  const toolName = getString(name);
  if (toolName) {
    toolNames.push(toolName);
  }
}
