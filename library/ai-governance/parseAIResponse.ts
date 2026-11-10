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

type ResponseFormat = {
  path: RegExp;
  model: (body: Record<string, unknown>, match: RegExpExecArray) => unknown;
  inputTokens: readonly string[];
  outputTokens: readonly string[];
  cacheReadTokens: readonly string[];
  cacheWriteTokens: readonly string[];
};

const modelFromBody: ResponseFormat["model"] = (body) =>
  getField(body, "model");

const anthropicUsage = {
  inputTokens: ["usage.input_tokens"],
  outputTokens: ["usage.output_tokens"],
  cacheReadTokens: ["usage.cache_read_input_tokens"],
  cacheWriteTokens: ["usage.cache_creation_input_tokens"],
} as const;

const FORMATS: readonly ResponseFormat[] = [
  // OpenAI Chat Completions
  {
    path: /\/chat\/completions$/,
    model: modelFromBody,
    inputTokens: ["usage.prompt_tokens"],
    outputTokens: ["usage.completion_tokens"],
    cacheReadTokens: ["usage.prompt_tokens_details.cached_tokens"],
    cacheWriteTokens: ["usage.prompt_tokens_details.cache_write_tokens"],
  },
  // OpenAI Responses
  {
    path: /\/responses$/,
    model: modelFromBody,
    inputTokens: ["usage.input_tokens"],
    outputTokens: ["usage.output_tokens"],
    cacheReadTokens: ["usage.input_tokens_details.cached_tokens"],
    cacheWriteTokens: ["usage.input_tokens_details.cache_write_tokens"],
  },
  // Anthropic Messages
  {
    path: /\/v1\/messages$/,
    model: modelFromBody,
    ...anthropicUsage,
  },
  // Anthropic on Vertex AI
  {
    path: /\/publishers\/anthropic\/models\/[^/]+:rawPredict$/,
    model: modelFromBody,
    ...anthropicUsage,
  },
  // Anthropic on Bedrock (InvokeModel)
  {
    path: /\/model\/([^/]+)\/invoke$/,
    model: modelFromBedrockPath,
    ...anthropicUsage,
  },
  // Bedrock Converse
  {
    path: /\/model\/([^/]+)\/converse$/,
    model: modelFromBedrockPath,
    inputTokens: ["usage.inputTokens"],
    outputTokens: ["usage.outputTokens"],
    cacheReadTokens: ["usage.cacheReadInputTokens"],
    cacheWriteTokens: ["usage.cacheWriteInputTokens"],
  },
  // Gemini generateContent
  {
    path: /\/models\/([^/:]+):generateContent$/,
    model: (body, match) => {
      const version = getField(body, "modelVersion");
      return typeof version === "string" && version ? version : match[1];
    },
    inputTokens: [
      "usageMetadata.promptTokenCount",
      "usageMetadata.toolUsePromptTokenCount",
    ],
    outputTokens: [
      "usageMetadata.candidatesTokenCount",
      "usageMetadata.thoughtsTokenCount",
    ],
    cacheReadTokens: ["usageMetadata.cachedContentTokenCount"],
    cacheWriteTokens: [],
  },
];

/** Bedrock puts the model in the path, unless it's an ARN (then the body might have it) */
function modelFromBedrockPath(
  body: Record<string, unknown>,
  match: RegExpExecArray
): unknown {
  const model = safeDecodeURIComponent(match[1]);
  return model && !model.startsWith("arn:")
    ? model
    : modelFromBody(body, match);
}

export function isAIRequestPath(pathname: string): boolean {
  return FORMATS.some((format) => format.path.test(pathname));
}

export function parseAIResponse(url: URL, body: unknown): AICall | undefined {
  if (!isPlainObject(body)) {
    return undefined;
  }

  for (const format of FORMATS) {
    const match = format.path.exec(url.pathname);
    if (!match) {
      continue;
    }
    const model = format.model(body, match);
    if (typeof model !== "string" || !model) {
      return undefined;
    }
    return createSafeObject({
      model,
      inputTokens: sum(body, format.inputTokens),
      outputTokens: sum(body, format.outputTokens),
      cacheReadTokens: sum(body, format.cacheReadTokens),
      cacheWriteTokens: sum(body, format.cacheWriteTokens),
    });
  }

  return undefined;
}

/** Reads a nested field, only following own properties (ignores a polluted prototype) */
function getField(body: Record<string, unknown>, path: string): unknown {
  let value: unknown = body;
  for (const key of path.split(".")) {
    if (
      !isPlainObject(value) ||
      !Object.prototype.hasOwnProperty.call(value, key)
    ) {
      return undefined;
    }
    value = value[key];
  }
  return value;
}

function sum(body: Record<string, unknown>, paths: readonly string[]) {
  let total = 0;
  for (const path of paths) {
    const value = getField(body, path);
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      total += value;
    }
  }
  return total;
}
