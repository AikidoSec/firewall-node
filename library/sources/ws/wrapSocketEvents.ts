/* eslint-disable max-lines-per-function */
import { AsyncResource } from "async_hooks";
import { Context, getContext } from "../../agent/Context";
import { getMaxWsMsgSize } from "../../helpers/getMaxWsMsgSize";
import type { WebSocket } from "ws";

export function wrapSocketEvent(handler: any, socket: WebSocket): any {
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
        wrapSocketEventHandler(args[0], args[1], socket)
      );

      return applyHandler(args);
    }

    return applyHandler();
  };
}

function wrapSocketEventHandler(
  event: string,
  handler: any,
  socket: WebSocket
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

    // Events with data
    if (event === "message" || event === "ping" || event === "pong") {
      // eslint-disable-next-line prefer-rest-params
      await onWsData(Array.from(arguments), context, socket);
    }

    // eslint-disable-next-line prefer-rest-params
    if (event === "close" && arguments.length > 1) {
      // eslint-disable-next-line prefer-rest-params
      await onWsData([arguments[1]], context, socket);
    }

    return applyHandler();
  };
}

export async function onWsData(
  args: any[],
  context: Context,
  socket?: WebSocket
) {
  if (!args.length) {
    return;
  }
  let data: ArrayBuffer | Blob | Buffer | Buffer[] | string;

  // Detect if its an event which contains the data
  if (
    typeof args[0] === "object" &&
    "data" in args[0] &&
    "type" in args[0] &&
    "target" in args[0]
  ) {
    data = args[0].data;
  } else {
    data = args[0];
  }

  const maxMsgSize = getMaxWsMsgSize();
  let messageStr: string | undefined;

  const tooLargeError = () => {
    if (!socket) return;
    socket.send(
      "WebSocket message size exceeded the maximum allowed size. Use AIKIDO_MAX_WS_MSG_SIZE_MB to increase the limit."
    );
    // Closing does not prevent the regular onMessage event from firing
    socket.terminate();
  };

  try {
    // Handle Blob
    if (global.Blob && data instanceof Blob) {
      if (data.size > maxMsgSize) {
        tooLargeError();
      }
      messageStr = await data.text();
      if (typeof messageStr !== "string" || messageStr.includes("\uFFFD")) {
        return;
      }
    } // Handle ArrayBuffer or Buffer
    else if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
      if (data.byteLength > maxMsgSize) {
        tooLargeError();
      }

      const decoder = new TextDecoder("utf-8", {
        fatal: true,
      });

      messageStr = decoder.decode(data);
    } //Check if is string
    else if (typeof data === "string") {
      if (Buffer.byteLength(data, "utf8") > maxMsgSize) {
        tooLargeError();
      }
      messageStr = data;
    } // Check if is array of Buffers
    else if (Array.isArray(data) && data.every((d) => Buffer.isBuffer(d))) {
      const concatenatedBuffer = Buffer.concat(data);
      if (concatenatedBuffer.byteLength > maxMsgSize) {
        tooLargeError();
      }
      const decoder = new TextDecoder("utf-8", {
        fatal: true,
      });

      messageStr = decoder.decode(concatenatedBuffer);
    } else {
      // Data type not supported
      return;
    }
  } catch (e) {
    // Ignore
    return;
  }

  if (typeof messageStr !== "string") {
    return;
  }

  context.ws = messageStr;

  // Try to parse the message as JSON
  try {
    context.ws = JSON.parse(messageStr);
  } catch (e) {
    // Ignore
  }
}
