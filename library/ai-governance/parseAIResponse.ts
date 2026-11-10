import { createSafeObject } from "../helpers/createSafeObject";
import { isPlainObject } from "../helpers/isPlainObject";
import { safeDecodeURIComponent } from "../helpers/safeDecodeURIComponent";

export type AICall = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

export function isAIRequestPath(pathname: string): boolean {
  return (
    pathname.endsWith("/chat/completions") ||
    pathname.endsWith("/responses") ||
    pathname.endsWith("/v1/messages") ||
    pathname.endsWith(":generateContent") ||
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
    return parseAnthropic(
      body,
      Object.prototype.hasOwnProperty.call(body, "model")
        ? body.model
        : undefined
    );
  }

  const gemini = /\/models\/([^/:]+):generateContent$/.exec(pathname);
  if (gemini) {
    return parseGemini(body, gemini[1]);
  }

  const bedrock = /\/model\/([^/]+)\/(converse|invoke)$/.exec(pathname);
  if (bedrock) {
    const model = safeDecodeURIComponent(bedrock[1]);
    let modelName = Object.prototype.hasOwnProperty.call(body, "model")
      ? body.model
      : undefined;
    if (model && !model.startsWith("arn:")) {
      modelName = model;
    }
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
  if (
    !Object.prototype.hasOwnProperty.call(body, "model") ||
    typeof body.model !== "string" ||
    !body.model
  ) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  if (
    Object.prototype.hasOwnProperty.call(body, "usage") &&
    isPlainObject(body.usage)
  ) {
    if (Object.prototype.hasOwnProperty.call(body.usage, "prompt_tokens")) {
      inputTokens = tokens(body.usage.prompt_tokens);
    }
    if (Object.prototype.hasOwnProperty.call(body.usage, "completion_tokens")) {
      outputTokens = tokens(body.usage.completion_tokens);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usage,
        "prompt_tokens_details"
      ) &&
      isPlainObject(body.usage.prompt_tokens_details) &&
      Object.prototype.hasOwnProperty.call(
        body.usage.prompt_tokens_details,
        "cached_tokens"
      )
    ) {
      cacheReadTokens = tokens(body.usage.prompt_tokens_details.cached_tokens);
    }
  }
  return createSafeObject({
    model: body.model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
  });
}

function parseOpenAIResponse(
  body: Record<string, unknown>
): AICall | undefined {
  if (
    !Object.prototype.hasOwnProperty.call(body, "model") ||
    typeof body.model !== "string" ||
    !body.model
  ) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  if (
    Object.prototype.hasOwnProperty.call(body, "usage") &&
    isPlainObject(body.usage)
  ) {
    if (Object.prototype.hasOwnProperty.call(body.usage, "input_tokens")) {
      inputTokens = tokens(body.usage.input_tokens);
    }
    if (Object.prototype.hasOwnProperty.call(body.usage, "output_tokens")) {
      outputTokens = tokens(body.usage.output_tokens);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usage,
        "input_tokens_details"
      ) &&
      isPlainObject(body.usage.input_tokens_details) &&
      Object.prototype.hasOwnProperty.call(
        body.usage.input_tokens_details,
        "cached_tokens"
      )
    ) {
      cacheReadTokens = tokens(body.usage.input_tokens_details.cached_tokens);
    }
  }
  return createSafeObject({
    model: body.model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
  });
}

function parseAnthropic(
  body: Record<string, unknown>,
  model: unknown
): AICall | undefined {
  if (typeof model !== "string" || !model) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  if (
    Object.prototype.hasOwnProperty.call(body, "usage") &&
    isPlainObject(body.usage)
  ) {
    if (Object.prototype.hasOwnProperty.call(body.usage, "input_tokens")) {
      inputTokens = tokens(body.usage.input_tokens);
    }
    if (Object.prototype.hasOwnProperty.call(body.usage, "output_tokens")) {
      outputTokens = tokens(body.usage.output_tokens);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usage,
        "cache_read_input_tokens"
      )
    ) {
      cacheReadTokens = tokens(body.usage.cache_read_input_tokens);
    }
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
  });
}

function parseBedrockConverse(
  body: Record<string, unknown>,
  model: unknown
): AICall | undefined {
  if (typeof model !== "string" || !model) {
    return undefined;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  if (
    Object.prototype.hasOwnProperty.call(body, "usage") &&
    isPlainObject(body.usage)
  ) {
    if (Object.prototype.hasOwnProperty.call(body.usage, "inputTokens")) {
      inputTokens = tokens(body.usage.inputTokens);
    }
    if (Object.prototype.hasOwnProperty.call(body.usage, "outputTokens")) {
      outputTokens = tokens(body.usage.outputTokens);
    }
    if (
      Object.prototype.hasOwnProperty.call(body.usage, "cacheReadInputTokens")
    ) {
      cacheReadTokens = tokens(body.usage.cacheReadInputTokens);
    }
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
  });
}

function parseGemini(
  body: Record<string, unknown>,
  modelFromPath: string
): AICall {
  let model = modelFromPath;
  if (
    Object.prototype.hasOwnProperty.call(body, "modelVersion") &&
    typeof body.modelVersion === "string" &&
    body.modelVersion
  ) {
    model = body.modelVersion;
  }
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  if (
    Object.prototype.hasOwnProperty.call(body, "usageMetadata") &&
    isPlainObject(body.usageMetadata)
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        body.usageMetadata,
        "promptTokenCount"
      )
    ) {
      inputTokens += tokens(body.usageMetadata.promptTokenCount);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usageMetadata,
        "toolUsePromptTokenCount"
      )
    ) {
      inputTokens += tokens(body.usageMetadata.toolUsePromptTokenCount);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usageMetadata,
        "candidatesTokenCount"
      )
    ) {
      outputTokens += tokens(body.usageMetadata.candidatesTokenCount);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usageMetadata,
        "thoughtsTokenCount"
      )
    ) {
      outputTokens += tokens(body.usageMetadata.thoughtsTokenCount);
    }
    if (
      Object.prototype.hasOwnProperty.call(
        body.usageMetadata,
        "cachedContentTokenCount"
      )
    ) {
      cacheReadTokens = tokens(body.usageMetadata.cachedContentTokenCount);
    }
  }
  return createSafeObject({
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens,
  });
}

function tokens(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return 0;
}
