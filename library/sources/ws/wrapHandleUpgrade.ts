import type { WebSocket } from "ws";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { IncomingMessage } from "http";
import { contextFromConnection } from "./contextFromConnection";
import { wrapSocketEvent } from "./wrapSocketEvents";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import { escapeHTML } from "../../helpers/escapeHTML";

// Wraps the WebSocketServer handleUpgrade callback, thats called when a new connection is established
export function wrapHandleUpgradeCallback(handler: any, agent: Agent): any {
  return async (socket: WebSocket, request: IncomingMessage) => {
    const context = contextFromConnection(request);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      if (!context) {
        return handler(socket, request);
      }

      if (context.user && agent.getConfig().isUserBlocked(context.user.id)) {
        return socket.close(3000, "You are blocked by Aikido firewall.");
      }

      const methodNames = [
        "on",
        "once",
        "addEventListener",
        "onmessage",
        "onclose",
        "onerror",
        "onopen",
      ];

      for (const methodName of methodNames) {
        const key = methodName as keyof WebSocket;
        if (typeof socket[key] !== "function") {
          continue;
        }
        // @ts-expect-error keyof does not exclude readonly properties
        socket[key] = wrapSocketEvent(socket[key], socket, agent);
      }

      return handler(socket, request);
    });
  };
}
