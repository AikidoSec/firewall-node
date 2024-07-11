import type { WebSocket } from "ws";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { IncomingMessage } from "http";
import { contextFromConnection } from "./contextFromConnection";
import { wrapSocketEvent } from "./wrapSocketEvents";

export function wrapConnectionHandler(handler: any, agent: Agent): any {
  return async (socket: WebSocket, request: IncomingMessage) => {
    const context = contextFromConnection(request);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      // Todo ratelimiting, user blocking

      socket.on = wrapSocketEvent(socket.on);
      socket.once = wrapSocketEvent(socket.once);
      socket.addEventListener = wrapSocketEvent(socket.addEventListener);

      return handler(socket, request);
    });
  };
}
