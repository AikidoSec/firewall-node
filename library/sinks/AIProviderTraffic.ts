import { subscribe } from "diagnostics_channel";
import type { ClientRequest, IncomingMessage } from "http";
import { getInstance } from "../agent/AgentSingleton";
import type { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { tryParseURL } from "../helpers/tryParseURL";
import { isAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";
import {
  type AIRequest,
  getAIProvider,
  getAIWireFormat,
} from "./ai-provider-traffic/matchAIRequest";
import {
  type AICall,
  maxAIResponseSize,
  parseAIResponse,
} from "./ai-provider-traffic/parseAIResponse";
import { parseHeaders } from "./undici/parseHeaders";

type ResponseCapture = {
  aiRequest: AIRequest;
  contentEncoding: string | undefined;
  chunks: Buffer[];
  size: number;
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

  undiciCaptures.set(request, {
    aiRequest: { format, provider: getAIProvider(hostname, format) },
    contentEncoding: undefined,
    chunks: [],
    size: 0,
  });
}

function onUndiciRequestHeaders({
  request,
  response,
}: UndiciHeadersMessage): void {
  const capture = undiciCaptures.get(request);
  if (!capture) {
    return;
  }

  const headers = Array.isArray(response.headers)
    ? parseHeaders(response.headers)
    : response.headers;

  if (
    !isPlainObject(headers) ||
    !isCapturableResponse(
      response.statusCode,
      getHeaderValue(headers["content-type"])
    )
  ) {
    undiciCaptures.delete(request);
    return;
  }

  capture.contentEncoding = getHeaderValue(headers["content-encoding"]);
}

function onUndiciBodyChunk({ request, chunk }: UndiciBodyChunkMessage): void {
  const capture = undiciCaptures.get(request);
  if (capture && !addChunk(capture, chunk)) {
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
  undiciCaptures.delete(request);
}

// Published when the response headers are parsed, before any body chunk
function onHTTPClientResponse({
  request,
  response,
}: HTTPClientResponseMessage): void {
  const format = getAIWireFormat(request.method, request.path);
  if (
    !format ||
    !isCapturableResponse(
      response.statusCode ?? 0,
      getHeaderValue(response.headers["content-type"])
    )
  ) {
    return;
  }

  let capture: ResponseCapture | undefined = {
    aiRequest: { format, provider: getAIProvider(request.host, format) },
    contentEncoding: getHeaderValue(response.headers["content-encoding"]),
    chunks: [],
    size: 0,
  };

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
        } else if (!addChunk(capture, args[0])) {
          capture = undefined;
        }
      } catch {
        capture = undefined;
      }
    }

    return push.apply(this, args);
  };
}

function isCapturableResponse(
  statusCode: number,
  contentType: string | undefined
): boolean {
  return (
    statusCode >= 200 &&
    statusCode < 300 &&
    !contentType?.includes("text/event-stream")
  );
}

function getHeaderValue(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim().toLowerCase() : undefined;
}

// Returns false when the response can't be captured
function addChunk(capture: ResponseCapture, chunk: unknown): boolean {
  if (!(chunk instanceof Uint8Array)) {
    return false;
  }

  capture.size += chunk.length;
  if (capture.size > maxAIResponseSize) {
    return false;
  }

  // Copy, the app owns the original buffer
  capture.chunks.push(Buffer.from(chunk));

  return true;
}

function finishCapture(capture: ResponseCapture): void {
  const { aiRequest } = capture;

  parseAIResponse(
    aiRequest.format,
    capture.contentEncoding,
    Buffer.concat(capture.chunks)
  )
    .then((call) => {
      if (call) {
        recordAICall(aiRequest.provider, call);
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
