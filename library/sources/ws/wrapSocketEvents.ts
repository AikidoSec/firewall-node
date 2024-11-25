/* eslint-disable max-lines-per-function */
import { AsyncResource } from "async_hooks";
import { getContext, updateContext } from "../../agent/Context";
import type { WebSocket } from "ws";
import { Agent } from "../../agent/Agent";
import { parseWsData } from "./parseWSData";

export function wrapSocketEvent(
  handler: any,
  socket: WebSocket,
  agent: Agent
): any {
  return function wrapped() {
    const applyHandler = (args: unknown[] | undefined = undefined) => {
      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        args || arguments
      );
    };

    const context = getContext();
    // We expect the context to be set by the connection handler
    if (!context) {
      return applyHandler();
    }

    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);
    if (
      args.length >= 2 &&
      typeof args[0] === "string" &&
      typeof args[1] === "function"
    ) {
      args[1] = AsyncResource.bind(
        wrapSocketEventHandler(args[0], args[1], socket, agent)
      );

      return applyHandler(args);
    }

    return applyHandler();
  };
}

function wrapSocketEventHandler(
  event: string,
  handler: any,
  socket: WebSocket,
  agent: Agent
): any {
  return async function wrappedHandler() {
    const applyHandler = () => {
      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };

    const context = getContext();
    if (!context) {
      return applyHandler();
    }

    let parsedData;

    // Events with data
    if (event === "message" || event === "ping" || event === "pong") {
      // eslint-disable-next-line prefer-rest-params
      parsedData = await parseWsData(Array.from(arguments), agent);
    }

    // eslint-disable-next-line prefer-rest-params
    if (event === "close" && arguments.length > 1) {
      // eslint-disable-next-line prefer-rest-params
      parsedData = await parseWsData([arguments[1]], agent);
    }

    if (parsedData) {
      if (parsedData.tooLarge) {
        socket.send(
          "WebSocket message size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit."
        );
        return; // Do not call the original handler
      }
      if (parsedData.data) {
        updateContext(context, "ws", parsedData.data);
      }
    }

    return applyHandler();
  };
}
