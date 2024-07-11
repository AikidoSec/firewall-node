import { Context, getContext, runWithContext } from "../../agent/Context";
import { isPlainObject } from "../../helpers/isPlainObject";

export function wrapSocketEvent(handler: any): any {
  return function wrapped() {
    const applyHandler = () => {
      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
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
      args.length < 2 ||
      typeof args[0] !== "string" ||
      typeof args[1] !== "function"
    ) {
      return applyHandler();
    }

    args[1] = wrapSocketEventHandler(args[0], args[1], context);

    return handler.apply(
      // @ts-expect-error We don't now the type of this
      this,
      args
    );
  };
}

function wrapSocketEventHandler(
  event: string,
  handler: any,
  context: Context
): any {
  return async function wrappedHandler() {
    // We need to call runWithContext again because the context of the connection handler is not passed to called event listeners
    return await runWithContext(context, async () => {
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

      return applyHandler();
    });
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
    if (data instanceof Blob) {
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
