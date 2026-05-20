import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { createParser } from "../../helpers/eventsource-parser/parse";
import type { EventSourceMessage } from "../../helpers/eventsource-parser/types";
import { isDebuggingSSE } from "../../helpers/isDebuggingSSE";
import { Token } from "../api/Token";
import { Logger } from "../logger/Logger";
import { getRealtimeURL } from "./getRealtimeURL";

const INITIAL_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 60 * 1000;
const READ_TIMEOUT_MS = 70 * 1000;

export function connectToSSE({
  token,
  logger,
  onEvent,
}: {
  token: Token;
  logger: Logger;
  onEvent: (event: EventSourceMessage) => void;
}) {
  let reconnectMs = INITIAL_RECONNECT_MS;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let currentRequest: ReturnType<typeof requestHttp> | null = null;

  const debugSSE = isDebuggingSSE();

  function logDebug(msg: string) {
    if (debugSSE) {
      logger.log(msg);
    }
  }

  function connect() {
    if (currentRequest) {
      currentRequest.destroy();
      currentRequest = null;
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
        if (response.statusCode !== 200) {
          logDebug(`SSE connection failed with status ${response.statusCode}`);
          response.destroy();
          scheduleReconnect();
          return;
        }

        reconnectMs = INITIAL_RECONNECT_MS;
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
          logDebug("SSE connection closed by server, reconnecting");
          parser.reset();
          scheduleReconnect();
        });

        response.on("error", (error) => {
          logDebug(`SSE stream error: ${error.message}`);
          parser.reset();
          scheduleReconnect();
        });
      }
    );

    currentRequest = req;

    req.on("socket", (socket) => {
      socket.setTimeout(READ_TIMEOUT_MS, () => {
        logDebug("SSE read timeout, reconnecting");
        req.destroy();
        scheduleReconnect();
      });
      // Don't keep the process alive just for the SSE connection
      socket.unref();
    });

    req.on("error", (error) => {
      logDebug(`SSE connection error: ${error.message}`);
      scheduleReconnect();
    });

    req.end();
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }

    logDebug(`SSE scheduling reconnect in ${reconnectMs}ms`);

    reconnectTimer = setTimeout(connect, reconnectMs);
    reconnectMs = Math.min(reconnectMs * 2, MAX_RECONNECT_MS);
    // Don't keep the process alive just for the reconnect timer
    reconnectTimer.unref();
  }

  connect();
}
