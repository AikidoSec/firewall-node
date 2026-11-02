import { isPlainObject } from "../helpers/isPlainObject";
import { safeDecodeURIComponent } from "../helpers/safeDecodeURIComponent";

export type AICall = {
  model: string;
  inputTokens: number;
  outputTokens: number;
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
    return parseAnthropic(body, body.model);
  }

  const gemini = /\/models\/([^/:]+):generateContent$/.exec(pathname);
  if (gemini) {
    return parseGemini(body, gemini[1]);
  }

  const bedrock = /\/model\/([^/]+)\/(converse|invoke)$/.exec(pathname);
  if (bedrock) {
    const model = safeDecodeURIComponent(bedrock[1]);
    let modelName = body.model;
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
  if (typeof body.model !== "string" || !body.model) {
    return undefined;
  }
  let usage: Record<string, unknown> = {};
  if (isPlainObject(body.usage)) {
    usage = body.usage;
  }
  return {
    model: body.model,
    inputTokens: tokens(usage.prompt_tokens),
    outputTokens: tokens(usage.completion_tokens),
  };
}

function parseOpenAIResponse(
  body: Record<string, unknown>
): AICall | undefined {
  if (typeof body.model !== "string" || !body.model) {
    return undefined;
  }
  let usage: Record<string, unknown> = {};
  if (isPlainObject(body.usage)) {
    usage = body.usage;
  }
  return {
    model: body.model,
    inputTokens: tokens(usage.input_tokens),
    outputTokens: tokens(usage.output_tokens),
  };
}

function parseAnthropic(
  body: Record<string, unknown>,
  model: unknown
): AICall | undefined {
  if (typeof model !== "string" || !model) {
    return undefined;
  }
  let usage: Record<string, unknown> = {};
  if (isPlainObject(body.usage)) {
    usage = body.usage;
  }
  return {
    model,
    inputTokens: tokens(usage.input_tokens),
    outputTokens: tokens(usage.output_tokens),
  };
}

function parseBedrockConverse(
  body: Record<string, unknown>,
  model: unknown
): AICall | undefined {
  if (typeof model !== "string" || !model) {
    return undefined;
  }
  let usage: Record<string, unknown> = {};
  if (isPlainObject(body.usage)) {
    usage = body.usage;
  }
  return {
    model,
    inputTokens: tokens(usage.inputTokens),
    outputTokens: tokens(usage.outputTokens),
  };
}

function parseGemini(
  body: Record<string, unknown>,
  modelFromPath: string
): AICall {
  let model = modelFromPath;
  if (typeof body.modelVersion === "string" && body.modelVersion) {
    model = body.modelVersion;
  }
  let usage: Record<string, unknown> = {};
  if (isPlainObject(body.usageMetadata)) {
    usage = body.usageMetadata;
  }
  return {
    model,
    inputTokens:
      tokens(usage.promptTokenCount) + tokens(usage.toolUsePromptTokenCount),
    outputTokens:
      tokens(usage.candidatesTokenCount) + tokens(usage.thoughtsTokenCount),
  };
}

function tokens(value: unknown): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return 0;
}
