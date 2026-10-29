import { isPlainObject } from "../../helpers/isPlainObject";
import type { AIWireFormat } from "./matchAIRequest";

export type AICall = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolNames: string[];
};

export function parseAIResponseBody(
  format: AIWireFormat,
  body: unknown
): AICall | undefined {
  const call = parseBody(format, body);
  if (!call || !call.model) {
    return undefined;
  }

  return call;
}

function parseBody(format: AIWireFormat, body: unknown): AICall | undefined {
  switch (format.type) {
    case "chat_completions":
      return parseChatCompletion(body);
    case "responses":
      return parseResponse(body);
    case "anthropic_messages":
      return parseAnthropicMessage(body);
    case "gemini_generate_content": {
      // streamGenerateContent without ?alt=sse returns a JSON array of chunks
      const parser = new AIEventStreamParser(format);
      for (const chunk of Array.isArray(body) ? body : [body]) {
        parser.onEvent(chunk);
      }
      return parser.getCall();
    }
  }
}

export class AIEventStreamParser {
  private call: AICall;
  private started = false;
  private chatToolCalls = new Map<string, string>();
  private anthropicToolCalls = new Set<number>();

  constructor(private readonly format: AIWireFormat) {
    this.call = createCall(
      format.type === "gemini_generate_content" ? format.pathModel : ""
    );
  }

  onEvent(event: unknown): void {
    switch (this.format.type) {
      case "chat_completions":
        return this.onChatCompletionChunk(event);
      case "responses":
        return this.onResponseEvent(event);
      case "anthropic_messages":
        return this.onAnthropicEvent(event);
      case "gemini_generate_content":
        return this.onGeminiChunk(event);
    }
  }

  getCall(): AICall | undefined {
    if (!this.started || !this.call.model) {
      return undefined;
    }

    if (this.format.type === "chat_completions") {
      this.call.toolNames = Array.from(this.chatToolCalls.values());
    }
    return this.call;
  }

  private onChatCompletionChunk(chunk: unknown): void {
    this.started = true;
    setModel(this.call, get(chunk, "model"));

    // Groq reports streaming usage under x_groq.usage
    const usage = get(chunk, "usage") ?? get(chunk, "x_groq", "usage");
    if (isPlainObject(usage)) {
      setChatCompletionUsage(this.call, usage);
    }

    for (const choice of getArray(get(chunk, "choices"))) {
      for (const toolCall of getArray(get(choice, "delta", "tool_calls"))) {
        const name =
          getString(get(toolCall, "function", "name")) ??
          getString(get(toolCall, "custom", "name"));
        const key = JSON.stringify([
          getTokens(get(choice, "index")),
          getTokens(get(toolCall, "index")),
        ]);
        if (name && this.chatToolCalls.size < 1024) {
          const previous = this.chatToolCalls.get(key) ?? "";
          if (previous.length + name.length <= 1024)
            this.chatToolCalls.set(key, previous + name);
        }
      }
      const legacyName = getString(
        get(choice, "delta", "function_call", "name")
      );
      if (legacyName && this.chatToolCalls.size < 1024) {
        const key = `legacy:${getTokens(get(choice, "index"))}`;
        const previous = this.chatToolCalls.get(key) ?? "";
        if (previous.length + legacyName.length <= 1024)
          this.chatToolCalls.set(key, previous + legacyName);
      }
    }
  }

  private onResponseEvent(event: unknown): void {
    const type = get(event, "type");
    const response = get(event, "response");
    setModel(this.call, get(response, "model"));
    if (type === "response.created" || type === "response.in_progress")
      this.started = true;
    if (
      type === "response.completed" ||
      type === "response.incomplete" ||
      type === "response.failed"
    ) {
      const call = parseResponse(get(event, "response"));
      if (call) {
        this.call = call;
        this.started = true;
      }
    }
  }

  private onAnthropicEvent(event: unknown): void {
    switch (get(event, "type")) {
      case "message_start":
        this.started = true;
        setModel(this.call, get(event, "message", "model"));
        setAnthropicUsage(this.call, get(event, "message", "usage"));
        return;
      case "message_delta":
        setAnthropicUsage(this.call, get(event, "usage"));
        return;
      case "content_block_start": {
        const index = getTokens(get(event, "index"));
        if (
          !this.anthropicToolCalls.has(index) &&
          this.anthropicToolCalls.size < 1024
        ) {
          this.anthropicToolCalls.add(index);
          addAnthropicToolName(this.call, get(event, "content_block"));
        }
        return;
      }
    }
  }

  private onGeminiChunk(chunk: unknown): void {
    const candidates = get(chunk, "candidates");
    const usage = get(chunk, "usageMetadata");
    if (candidates === undefined && usage === undefined) {
      return;
    }

    this.started = true;
    setModel(this.call, get(chunk, "modelVersion"));

    if (usage !== undefined) {
      // promptTokenCount already includes the cached tokens
      this.call.inputTokens =
        getTokens(get(usage, "promptTokenCount")) +
        getTokens(get(usage, "toolUsePromptTokenCount"));
      this.call.outputTokens =
        getTokens(get(usage, "candidatesTokenCount")) +
        getTokens(get(usage, "thoughtsTokenCount"));
    }

    for (const candidate of getArray(candidates)) {
      for (const part of getArray(get(candidate, "content", "parts"))) {
        addToolName(this.call.toolNames, get(part, "functionCall", "name"));
      }
    }
  }
}

function parseChatCompletion(body: unknown): AICall | undefined {
  const choices = get(body, "choices");
  if (!Array.isArray(choices)) {
    return undefined;
  }

  const call = createCall(getString(get(body, "model")) ?? "");
  setChatCompletionUsage(call, get(body, "usage"));

  for (const choice of choices) {
    for (const toolCall of getArray(get(choice, "message", "tool_calls"))) {
      addToolName(
        call.toolNames,
        getString(get(toolCall, "function", "name")) ??
          get(toolCall, "custom", "name")
      );
    }
    addToolName(
      call.toolNames,
      get(choice, "message", "function_call", "name")
    );
  }

  return call;
}

function parseResponse(body: unknown): AICall | undefined {
  const output = get(body, "output");
  if (!Array.isArray(output)) {
    return undefined;
  }

  const call = createCall(getString(get(body, "model")) ?? "");
  const usage = get(body, "usage");
  call.inputTokens = getTokens(get(usage, "input_tokens"));
  call.outputTokens = getTokens(get(usage, "output_tokens"));
  for (const item of output) {
    addToolName(call.toolNames, getResponseToolName(item));
  }

  return call;
}

function parseAnthropicMessage(body: unknown): AICall | undefined {
  const content = get(body, "content");
  if (!Array.isArray(content)) {
    return undefined;
  }

  const call = createCall(getString(get(body, "model")) ?? "");
  setAnthropicUsage(call, get(body, "usage"));

  for (const block of content) {
    addAnthropicToolName(call, block);
  }

  return call;
}

function setChatCompletionUsage(call: AICall, usage: unknown): void {
  call.inputTokens = getTokens(get(usage, "prompt_tokens"));
  call.outputTokens = getTokens(get(usage, "completion_tokens"));
}

// Keeps the current counts for missing fields, a stream sends them in parts
function setAnthropicUsage(call: AICall, usage: unknown): void {
  call.inputTokens = getTokens(get(usage, "input_tokens"), call.inputTokens);
  call.outputTokens = getTokens(get(usage, "output_tokens"), call.outputTokens);
}

function addAnthropicToolName(call: AICall, block: unknown): void {
  const type = get(block, "type");
  if (
    type === "tool_use" ||
    type === "server_tool_use" ||
    type === "mcp_tool_use"
  ) {
    addToolName(call.toolNames, get(block, "name"));
  }
}

function createCall(model: string): AICall {
  return {
    model,
    inputTokens: 0,
    outputTokens: 0,
    toolNames: [],
  };
}

function setModel(call: AICall, model: unknown): void {
  const value = getString(model);
  if (value) {
    call.model = value;
  }
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
  return typeof value === "string" && value.length > 0 && value.length <= 1024
    ? value
    : undefined;
}

function getTokens(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

function addToolName(toolNames: string[], name: unknown): void {
  const toolName = getString(name);
  if (toolName && toolName.length <= 1024 && toolNames.length < 1024) {
    toolNames.push(toolName);
  }
}

function getResponseToolName(item: unknown): string | undefined {
  const type = get(item, "type");
  if (
    type !== "function_call" &&
    type !== "custom_tool_call" &&
    type !== "mcp_call"
  )
    return undefined;
  const name = getString(get(item, "name"));
  const namespace = getString(get(item, "namespace"));
  return name && namespace ? namespace + name : name;
}
