import { subscribe } from "diagnostics_channel";
import type { ClientRequest, IncomingMessage } from "http";
import { getInstance } from "../agent/AgentSingleton";
import type { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { tryParseURL } from "../helpers/tryParseURL";
import {
  type AIResponseReader,
  createAIResponseReader,
} from "./ai-provider-traffic/AIResponseReader";
import { isAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";
import {
  type AIRequest,
  getAIProvider,
  getAIWireFormat,
} from "./ai-provider-traffic/matchAIRequest";
import type { AICall } from "./ai-provider-traffic/parseAIResponse";
import { parseHeaders } from "./undici/parseHeaders";

type ResponseCapture = {
  provider: string;
  reader: AIResponseReader;
};

type UndiciRequest = { method: string; origin: string | URL; path: string };

type UndiciRequestMessage = { request: UndiciRequest };

type UndiciHeadersMessage = {
  request: UndiciRequest;
  response: { statusCode: number; headers: unknown };
};

type UndiciBodyChunkMessage = { request: UndiciRequest; chunk: unknown };

type HTTPClientResponseMessage = {
  request: ClientRequest;
  response: IncomingMessage;
};

const undiciAIRequests = new WeakMap<UndiciRequest, AIRequest>();
const undiciCaptures = new WeakMap<UndiciRequest, ResponseCapture>();

export class AIProviderTraffic implements Wrapper {
  wrap(): void {
    if (!isAINetworkCaptureActive()) {
      return;
    }

    subscribeSafely("undici:request:create", onUndiciRequestCreate);
    subscribeSafely("undici:request:headers", onUndiciRequestHeaders);
    subscribeSafely("undici:request:bodyChunkReceived", onUndiciBodyChunk);
    subscribeSafely("undici:request:trailers", onUndiciRequestEnd);
    subscribeSafely("undici:request:error", onUndiciRequestError);
    subscribeSafely("http.client.response.finish", onHTTPClientResponse);
  }
}

function subscribeSafely<T>(
  name: string,
  onMessage: (message: T) => void
): void {
  subscribe(name, (message) => {
    try {
      onMessage(message as T);
    } catch {
      // A throwing subscriber would become an uncaught exception in the app
    }
  });
}

function onUndiciRequestCreate({ request }: UndiciRequestMessage): void {
  const format = getAIWireFormat(request.method, request.path);
  if (!format) {
    return;
  }

  const hostname =
    request.origin instanceof URL
      ? request.origin.hostname
      : tryParseURL(request.origin)?.hostname;
  if (!hostname) {
    return;
  }

  undiciAIRequests.set(request, {
    format,
    provider: getAIProvider(hostname, format),
  });
}

function onUndiciRequestHeaders({
  request,
  response,
}: UndiciHeadersMessage): void {
  const aiRequest = undiciAIRequests.get(request);
  if (!aiRequest) {
    return;
  }
  undiciAIRequests.delete(request);

  const headers = Array.isArray(response.headers)
    ? parseHeaders(response.headers)
    : response.headers;
  if (!isPlainObject(headers)) {
    return;
  }

  const capture = createCapture(
    aiRequest,
    response.statusCode,
    headers["content-type"],
    headers["content-encoding"]
  );
  if (capture) {
    undiciCaptures.set(request, capture);
  }
}

function onUndiciBodyChunk({ request, chunk }: UndiciBodyChunkMessage): void {
  const capture = undiciCaptures.get(request);
  if (capture && !writeChunk(capture, chunk)) {
    undiciCaptures.delete(request);
  }
}

function onUndiciRequestEnd({ request }: UndiciRequestMessage): void {
  const capture = undiciCaptures.get(request);
  if (capture) {
    undiciCaptures.delete(request);
    finishCapture(capture);
  }
}

function onUndiciRequestError({ request }: UndiciRequestMessage): void {
  undiciAIRequests.delete(request);
  undiciCaptures.delete(request);
}

// Published when the response headers are parsed, before any body chunk
function onHTTPClientResponse({
  request,
  response,
}: HTTPClientResponseMessage): void {
  const format = getAIWireFormat(request.method, request.path);
  if (!format) {
    return;
  }

  let capture = createCapture(
    { format, provider: getAIProvider(request.host, format) },
    response.statusCode ?? 0,
    response.headers["content-type"],
    response.headers["content-encoding"]
  );
  if (!capture) {
    return;
  }

  // A 'data' listener would switch the stream to flowing mode,
  // apps that start reading later would lose the body
  const push = response.push;
  response.push = function pushAndCapture(
    this: IncomingMessage,
    ...args: Parameters<IncomingMessage["push"]>
  ) {
    if (capture) {
      try {
        if (args[0] === null) {
          finishCapture(capture);
          capture = undefined;
        } else if (!writeChunk(capture, args[0])) {
          capture = undefined;
        }
      } catch {
        capture = undefined;
      }
    }

    return push.apply(this, args);
  };
}

function createCapture(
  aiRequest: AIRequest,
  statusCode: number,
  contentType: unknown,
  contentEncoding: unknown
): ResponseCapture | undefined {
  if (statusCode < 200 || statusCode >= 300) {
    return undefined;
  }

  const reader = createAIResponseReader(
    aiRequest.format,
    getHeaderValue(contentType),
    getHeaderValue(contentEncoding)
  );
  if (!reader) {
    return undefined;
  }

  return { provider: aiRequest.provider, reader };
}

function getHeaderValue(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim().toLowerCase() : undefined;
}

// Returns false when the response can't be captured
function writeChunk(capture: ResponseCapture, chunk: unknown): boolean {
  return chunk instanceof Uint8Array && capture.reader.write(chunk);
}

function finishCapture(capture: ResponseCapture): void {
  capture.reader
    .end()
    .then((call) => {
      if (call) {
        recordAICall(capture.provider, call);
      }
    })
    .catch(() => {});
}

function recordAICall(provider: string, call: AICall): void {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  const aiStats = agent.getAIStatistics();
  aiStats.onAICall({
    provider,
    model: call.model,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    cacheReadTokens: call.cacheReadTokens,
    cacheWriteTokens: call.cacheWriteTokens,
  });

  for (const name of call.toolNames) {
    aiStats.onAIToolCall({ name, blocked: false });
  }
}
