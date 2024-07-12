/* eslint-disable max-lines-per-function */
import { AsyncResource } from "async_hooks";
import { Context, getContext, runWithContext } from "../../agent/Context";

export function wrapSocketEvent(handler: any): any {
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
      args[1] = AsyncResource.bind(wrapSocketEventHandler(args[0], args[1]));

      return applyHandler(args);
    }

    return applyHandler();
  };
}

function wrapSocketEventHandler(event: string, handler: any): any {
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
      await onWsData(Array.from(arguments), context);
    }

    // eslint-disable-next-line prefer-rest-params
    if (event === "close" && arguments.length > 1) {
      // eslint-disable-next-line prefer-rest-params
      await onWsData([arguments[1]], context);
    }

    return applyHandler();
  };
}

export async function onWsData(args: any[], context: Context) {
  if (!args.length) {
    return;
  }
  let data: ArrayBuffer | Blob | Buffer | Buffer[];

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

  let messageStr: string | undefined;

  try {
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
    else if (Array.isArray(data) && data.every((d) => Buffer.isBuffer(d))) {
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

  context.ws = messageStr;

  // Try to parse the message as JSON
  try {
    context.ws = JSON.parse(messageStr);
  } catch (e) {
    // Ignore
  }
}
