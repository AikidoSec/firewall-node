import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { createParser } from "../../helpers/eventsource-parser/parse";
import type { EventSourceMessage } from "../../helpers/eventsource-parser/types";
import { isDebuggingSSE } from "../../helpers/isDebuggingSSE";
import { Token } from "../api/Token";
import { Logger } from "../logger/Logger";
import { getRealtimeURL } from "./getRealtimeURL";

const INITIAL_RECONNECT_MS = 5000;
const MAX_RECONNECT_MS = 60 * 1000;
const STABLE_CONNECTION_MS = 30 * 1000;
const READ_TIMEOUT_MS = 70 * 1000;

type ConnectResult =
  | { outcome: "error" }
  | { outcome: "disconnected"; statusCode: number };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

function connect({
  token,
  onEvent,
  readTimeoutMs,
  logDebug,
}: {
  token: Token;
  onEvent: (event: EventSourceMessage) => void;
  readTimeoutMs: number;
  logDebug: (msg: string) => void;
}): Promise<ConnectResult> {
  return new Promise<ConnectResult>((resolve) => {
    let resolved = false;

    function resolveOnce(result: ConnectResult) {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve(result);
    }

    const url = new URL(`${getRealtimeURL().toString()}api/runtime/stream`);

    logDebug(`SSE connecting to ${url.toString()}`);

    const requestFn = url.protocol === "https:" ? requestHttps : requestHttp;

    const req = requestFn(
      url.toString(),
      {
        method: "GET",
        headers: {
          Authorization: token.asString(),
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
      },
      (response) => {
        const statusCode = response.statusCode!;

        if (statusCode !== 200) {
          response.destroy();
          resolveOnce({ outcome: "disconnected", statusCode });
          return;
        }

        logDebug("SSE connected successfully");

        const parser = createParser({
          onEvent(event) {
            onEvent(event);
          },
        });

        response.setEncoding("utf-8");

        response.on("data", (chunk: string) => {
          logDebug(`SSE received chunk: ${chunk.trimEnd()}`);
          parser.feed(chunk);
        });

        response.on("end", () => {
          logDebug("SSE connection closed by server");
          parser.reset();
          resolveOnce({ outcome: "disconnected", statusCode });
        });

        response.on("error", (error) => {
          logDebug(`SSE stream error: ${error.message}`);
          parser.reset();
          resolveOnce({ outcome: "disconnected", statusCode });
        });
      }
    );

    req.on("socket", (socket) => {
      socket.setTimeout(readTimeoutMs, () => {
        if (socket.destroyed) {
          return;
        }
        logDebug("SSE read timeout");
        resolveOnce({ outcome: "error" });
        req.destroy();
      });
      socket.unref();
    });

    req.on("error", (error) => {
      logDebug(`SSE connection error: ${error.message}`);
      resolveOnce({ outcome: "error" });
    });

    req.end();
  });
}

export function connectToSSE({
  token,
  logger,
  onEvent,
  initialReconnectMs = INITIAL_RECONNECT_MS,
  readTimeoutMs = READ_TIMEOUT_MS,
}: {
  token: Token;
  logger: Logger;
  onEvent: (event: EventSourceMessage) => void;
  initialReconnectMs?: number;
  readTimeoutMs?: number;
}) {
  let reconnectMs = initialReconnectMs;

  const debugSSE = isDebuggingSSE();

  function logDebug(msg: string) {
    if (debugSSE) {
      logger.log(msg);
    }
  }

  async function loop() {
    while (true) {
      const start = Date.now();
      const result = await connect({ token, onEvent, readTimeoutMs, logDebug });

      if (
        result.outcome === "disconnected" &&
        (result.statusCode === 401 || result.statusCode === 403)
      ) {
        logger.log(
          `SSE connection rejected with status ${result.statusCode}, stopping`
        );
        return;
      }

      if (Date.now() - start >= STABLE_CONNECTION_MS) {
        reconnectMs = initialReconnectMs;
      }

      const jitter = Math.random() * (reconnectMs / 2);
      const delayMs = reconnectMs + jitter;

      logDebug(`SSE scheduling reconnect in ${Math.round(delayMs)}ms`);

      reconnectMs = Math.min(reconnectMs * 2, MAX_RECONNECT_MS);

      await delay(delayMs);
    }
  }

  loop().catch(() => {});
}
