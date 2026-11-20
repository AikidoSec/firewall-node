import { createSafeObject } from "../helpers/createSafeObject";
import { isPlainObject } from "../helpers/isPlainObject";
import { safeDecodeURIComponent } from "../helpers/safeDecodeURIComponent";

export type AICall = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export function isAIRequestPath(pathname: string): boolean {
  return (
    pathname.endsWith("/chat/completions") ||
    pathname.endsWith("/responses") ||
    pathname.endsWith("/v1/messages") ||
    pathname.endsWith(":generateContent") ||
    pathname.endsWith("/interactions") ||
    pathname.endsWith(":rawPredict") ||
    pathname.endsWith("/converse") ||
    pathname.endsWith("/invoke")
  );
}

export function parseAIResponse(url: URL, body: unknown): AICall | undefined {
  if (!isPlainObject(body)) {
    return undefined;
  }

  const { pathname } = url;
  if (pathname.endsWith("/chat/completions")) {
    return parseOpenAIChatCompletion(body);
  }
  if (pathname.endsWith("/responses")) {
    return parseOpenAIResponse(body);
  }
  if (
    pathname.endsWith("/v1/messages") ||
    /\/publishers\/anthropic\/models\/[^/]+:rawPredict$/.test(pathname)
  ) {
    return parseAnthropic(body, nonEmptyString(body, "model"));
  }

  const gemini = /\/models\/([^/:]+):generateContent$/.exec(pathname);
  if (gemini) {
    return parseGemini(body, gemini[1]);
  }

  if (pathname.endsWith("/interactions")) {
    return parseGeminiInteraction(body);
  }

  const bedrock = /\/model\/([^/]+)\/(converse|invoke)$/.exec(pathname);
  if (bedrock) {
    const model = safeDecodeURIComponent(bedrock[1]);
    const modelName =
      model && !model.startsWith("arn:")
        ? model
        : (nonEmptyString(body, "model") ?? model);
    if (bedrock[2] === "converse") {
      return parseBedrockConverse(body, modelName);
    }
    return parseAnthropic(body, modelName);
  }
  return undefined;
}

function parseOpenAIChatCompletion(
  body: Record<string, unknown>
): AICall | undefined {
  const model = nonEmptyString(body, "model");
  if (!model) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  if (Object.hasOwn(body, "usage") && isPlainObject(body.usage)) {
    inputTokens = tokens(body.usage, "prompt_tokens");
    outputTokens = tokens(body.usage, "completion_tokens");
    if (
      Object.hasOwn(body.usage, "prompt_tokens_details") &&
      isPlainObject(body.usage.prompt_tokens_details)
    ) {
      const details = body.usage.prompt_tokens_details;
      cacheReadTokens = tokens(details, "cached_tokens");
      cacheWriteTokens = tokens(details, "cache_write_tokens");
    }
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  });
}

function parseOpenAIResponse(
  body: Record<string, unknown>
): AICall | undefined {
  const model = nonEmptyString(body, "model");
  if (!model) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  if (Object.hasOwn(body, "usage") && isPlainObject(body.usage)) {
    inputTokens = tokens(body.usage, "input_tokens");
    outputTokens = tokens(body.usage, "output_tokens");
    if (
      Object.hasOwn(body.usage, "input_tokens_details") &&
      isPlainObject(body.usage.input_tokens_details)
    ) {
      const details = body.usage.input_tokens_details;
      cacheReadTokens = tokens(details, "cached_tokens");
      cacheWriteTokens = tokens(details, "cache_write_tokens");
    }
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  });
}

function parseAnthropic(
  body: Record<string, unknown>,
  model: string | undefined
): AICall | undefined {
  if (!model) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  if (Object.hasOwn(body, "usage") && isPlainObject(body.usage)) {
    outputTokens = tokens(body.usage, "output_tokens");
    cacheReadTokens = tokens(body.usage, "cache_read_input_tokens");
    cacheWriteTokens = tokens(body.usage, "cache_creation_input_tokens");
    // Anthropic's input_tokens excludes cache reads and writes.
    inputTokens =
      tokens(body.usage, "input_tokens") + cacheReadTokens + cacheWriteTokens;
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  });
}

function parseBedrockConverse(
  body: Record<string, unknown>,
  model: string | undefined
): AICall | undefined {
  if (!model) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  if (Object.hasOwn(body, "usage") && isPlainObject(body.usage)) {
    outputTokens = tokens(body.usage, "outputTokens");
    cacheReadTokens = tokens(body.usage, "cacheReadInputTokens");
    cacheWriteTokens = tokens(body.usage, "cacheWriteInputTokens");
    // Bedrock's inputTokens excludes cache reads and writes.
    inputTokens =
      tokens(body.usage, "inputTokens") + cacheReadTokens + cacheWriteTokens;
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  });
}

function parseGemini(
  body: Record<string, unknown>,
  modelFromPath: string
): AICall {
  const model = nonEmptyString(body, "modelVersion") ?? modelFromPath;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  if (
    Object.hasOwn(body, "usageMetadata") &&
    isPlainObject(body.usageMetadata)
  ) {
    inputTokens += tokens(body.usageMetadata, "promptTokenCount");
    inputTokens += tokens(body.usageMetadata, "toolUsePromptTokenCount");
    outputTokens += tokens(body.usageMetadata, "candidatesTokenCount");
    outputTokens += tokens(body.usageMetadata, "thoughtsTokenCount");
    cacheReadTokens = tokens(body.usageMetadata, "cachedContentTokenCount");
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens: 0,
  });
}

// Gemini Interactions API (POST /v1beta/interactions)
function parseGeminiInteraction(
  body: Record<string, unknown>
): AICall | undefined {
  if (!Object.hasOwn(body, "usage") || !isPlainObject(body.usage)) {
    return undefined;
  }
  // An interaction run by an agent names the agent instead of a model.
  return createSafeObject({
    model:
      nonEmptyString(body, "model") ??
      nonEmptyString(body, "agent") ??
      "unknown",
    inputTokens:
      tokens(body.usage, "total_input_tokens") +
      tokens(body.usage, "total_tool_use_tokens"),
    outputTokens:
      tokens(body.usage, "total_output_tokens") +
      tokens(body.usage, "total_thought_tokens"),
    cacheReadTokens: tokens(body.usage, "total_cached_tokens"),
    cacheWriteTokens: 0,
  });
}

function nonEmptyString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const value = Object.hasOwn(obj, key) ? obj[key] : undefined;
  return typeof value === "string" && value ? value : undefined;
}

function tokens(obj: object, key: string): number {
  if (!Object.hasOwn(obj, key)) {
    return 0;
  }
  const value = (obj as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return 0;
}
