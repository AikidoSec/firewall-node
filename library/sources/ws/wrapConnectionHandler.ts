import type { WebSocket } from "ws";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { IncomingMessage } from "http";
import { contextFromConnection } from "./contextFromConnection";
import { wrapSocketEventHandler } from "./wrapSocketEvents";

export function wrapConnectionHandler(handler: any, agent: Agent): any {
  return async (socket: WebSocket, request: IncomingMessage) => {
    const context = contextFromConnection(socket, request);

    return runWithContext(context, () => {
      // Even though we already have the context, we need to get it again
      // The context from `contextFromRequest` will never return a user
      // The user will be carried over from the previous context
      const context = getContext();

      // Todo ratelimiting, user blocking

      socket.on = wrapSocketEventHandler(socket.on, agent);
      socket.addEventListener = wrapSocketEventHandler(
        socket.addEventListener,
        agent
      );
      socket.once = wrapSocketEventHandler(socket.once, agent);

      return handler(socket, request);
    });
  };
}
