import { channel } from "diagnostics_channel";
import type { ClientRequest, IncomingMessage } from "http";
import { getInstance } from "../agent/AgentSingleton";
import type { Agent } from "../agent/Agent";
import type { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";
import { isVersionGreaterOrEqual } from "../helpers/isVersionGreaterOrEqual";
import { tryParseURL } from "../helpers/tryParseURL";
import {
  createAIResponseReader,
  type AIResponseReader,
} from "./ai-provider-traffic/AIResponseReader";
import {
  getAIProvider,
  getAIWireFormat,
  type AIRequest,
} from "./ai-provider-traffic/matchAIRequest";
import { setAINetworkCaptureActive } from "./ai-provider-traffic/isAINetworkCaptureActive";
import type { AICall } from "./ai-provider-traffic/parseAIResponse";
import { parseHeaders } from "./undici/parseHeaders";

type UndiciRequest = { method: string; origin: string | URL; path: string };
type UndiciMessage = { request: UndiciRequest };
type UndiciHeaders = UndiciMessage & {
  response: { statusCode: number; headers: unknown };
};
type UndiciChunk = UndiciMessage & { chunk: Uint8Array };
type HTTPResponse = { request: ClientRequest; response: IncomingMessage };

const captures = new WeakMap<UndiciRequest, AIResponseReader>();
let subscribed = false;

export class AIProviderTraffic implements Wrapper {
  wrap(): void {
    if (subscribed) return;
    subscribed = true;
    setAINetworkCaptureActive(
      isVersionGreaterOrEqual("7.11.0", process.versions.undici ?? "")
    );
    subscribeSafely("http.client.response.finish", onHTTPResponse);
    subscribeSafely("undici:request:headers", onUndiciHeaders);
    subscribeSafely("undici:request:bodyChunkReceived", onUndiciChunk);
    subscribeSafely("undici:request:trailers", onUndiciEnd);
    subscribeSafely("undici:request:error", onUndiciError);
  }
}

function subscribeSafely<T>(
  name: string,
  callback: (message: T) => void
): void {
  channel(name).subscribe((message) => {
    // Subscriber exceptions become uncaughtException, not request errors.
    try {
      callback(message as T);
    } catch {
      return;
    }
  });
}

function matchRequest(
  method: string,
  path: string,
  hostname: string
): AIRequest | undefined {
  const format = getAIWireFormat(method, path);
  return format
    ? { format, provider: getAIProvider(hostname, format) }
    : undefined;
}

function onUndiciHeaders({ request, response }: UndiciHeaders): void {
  const format = getAIWireFormat(request.method, request.path);
  if (!format) return;
  const hostname =
    request.origin instanceof URL
      ? request.origin.hostname
      : tryParseURL(request.origin)?.hostname;
  if (!hostname) return;
  const aiRequest = { format, provider: getAIProvider(hostname, format) };
  const headers = Array.isArray(response.headers)
    ? parseHeaders(response.headers)
    : response.headers;
  if (!isPlainObject(headers)) return;
  const reader = createReader(
    aiRequest,
    response.statusCode,
    headers["content-type"],
    headers["content-encoding"]
  );
  if (reader) captures.set(request, reader);
}

function onUndiciChunk({ request, chunk }: UndiciChunk): void {
  const reader = captures.get(request);
  if (reader) setAINetworkCaptureActive(true);
  if (reader && !reader.write(chunk)) {
    reader.destroy();
    captures.delete(request);
  }
}

function onUndiciEnd({ request }: UndiciMessage): void {
  const reader = captures.get(request);
  captures.delete(request);
  reader?.end();
}

function onUndiciError({ request }: UndiciMessage): void {
  captures.get(request)?.destroy();
  captures.delete(request);
}

function onHTTPResponse({ request, response }: HTTPResponse): void {
  const aiRequest = matchRequest(request.method, request.path, request.host);
  if (!aiRequest) return;
  let reader = createReader(
    aiRequest,
    response.statusCode ?? 0,
    response.headers["content-type"],
    response.headers["content-encoding"]
  );
  if (!reader) return;
  setAINetworkCaptureActive(true);

  // A data listener would consume the response before applications start reading it.
  const push = response.push;
  response.push = function pushAndCapture(
    ...args: Parameters<IncomingMessage["push"]>
  ) {
    try {
      if (args[0] === null) {
        if (response.complete) reader?.end();
        else reader?.destroy();
        reader = undefined;
      } else if (reader && !reader.write(args[0])) {
        reader.destroy();
        reader = undefined;
      }
    } catch {
      reader?.destroy();
      reader = undefined;
    }
    return push.apply(this, args);
  };
  response.once("close", () => {
    reader?.destroy();
    reader = undefined;
  });
}

function createReader(
  request: AIRequest,
  status: number,
  contentType: unknown,
  contentEncoding: unknown
): AIResponseReader | undefined {
  const agent = getInstance();
  if (!agent || status < 200 || status >= 300) return undefined;
  return createAIResponseReader(
    request.format,
    typeof contentType === "string" ? contentType : undefined,
    typeof contentEncoding === "string" ? contentEncoding : undefined,
    (call) => {
      if (call) recordCall(agent, request.provider, call);
    }
  );
}

function recordCall(agent: Agent, provider: string, call: AICall): void {
  const stats = agent.getAIStatistics();
  stats.onAICall({
    provider,
    model: call.model,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
  });
  for (const name of call.toolNames)
    stats.onAIToolCall({ name, blocked: false });
}
