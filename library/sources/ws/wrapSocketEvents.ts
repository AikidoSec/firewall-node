/* eslint-disable max-lines-per-function */
import { AsyncResource } from "async_hooks";
import { Context, getContext } from "../../agent/Context";
import type { WebSocket } from "ws";
import { getMaxBodySize } from "../../helpers/getMaxBodySize";

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

type WsData = ArrayBuffer | Blob | Buffer | Buffer[] | string;

/**
 * If the ws event arg is an event object, extract the data from it
 */
function extractWsDataFromEvent(arg: unknown): WsData {
  if (
    typeof arg === "object" &&
    arg !== null &&
    "data" in arg &&
    "type" in arg &&
    "target" in arg
  ) {
    return arg.data as WsData;
  }
  return arg as WsData;
}

/**
 * Tried to parse the data as JSON, if it fails it returns the original data
 */
function tryJSONParse(data: string) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return data;
  }
}

function isBufferArray(data: WsData): boolean {
  return Array.isArray(data) && data.every((d) => Buffer.isBuffer(d));
}

function checkWsDataSize(data: WsData) {
  const maxMsgSize = getMaxBodySize();
  let size = -1;

  if (global.Blob && data instanceof Blob) {
    size = data.size;
  } else if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
    size = data.byteLength;
  } else if (typeof data === "string") {
    size = Buffer.byteLength(data, "utf8");
  } else if (isBufferArray(data)) {
    // @ts-expect-error Typescript does not detect that data can not be an blob because of the global.Blob check required for Node.js 16
    size = Buffer.concat(data).byteLength;
  }

  return size > maxMsgSize;
}

export async function onWsData(
  args: any[],
  context: Context,
  socket?: WebSocket
) {
  if (!args.length) {
    return;
  }
  const data = extractWsDataFromEvent(args[0]);
  let messageStr: string | undefined;

  try {
    const tooLarge = checkWsDataSize(data);
    if (tooLarge) {
      if (!socket) return;
      socket.send(
        "WebSocket message size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit."
      );
      // Closing does not prevent the regular onMessage event from firing
      socket.terminate();
      return;
    }

    // Handle Blob
    if (global.Blob && data instanceof Blob) {
      messageStr = await data.text();
      if (typeof messageStr !== "string" || messageStr.includes("\uFFFD")) {
        return;
      }
    } // Handle ArrayBuffer or Buffer
    else if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
      const decoder = new TextDecoder("utf-8", {
        fatal: true,
      });

      messageStr = decoder.decode(data);
    } //Check if is string
    else if (typeof data === "string") {
      messageStr = data;
    } // Check if is array of Buffers
    else if (isBufferArray(data)) {
      // @ts-expect-error Typescript does not detect that data can not be an blob because of the global.Blob check required for Node.js 16
      const concatenatedBuffer = Buffer.concat(data);
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

  context.ws = tryJSONParse(messageStr);
}
