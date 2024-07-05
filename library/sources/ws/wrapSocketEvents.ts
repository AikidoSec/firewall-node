import { Agent } from "../../agent/Agent";
import { Context, getContext, runWithContext } from "../../agent/Context";

export function wrapSocketEventHandler(handler: any, agent: Agent): any {
  return function wrappedEvent(event: string, listener: unknown) {
    const applyHandler = () => {
      return handler.apply(
        // @ts-expect-error We don't now the type of this
        this,
        [event, listener]
      );
    };

    const context = getContext();
    // We expect the context to be set by the connection handler
    if (!context) {
      return applyHandler();
    }

    // Todo limit wrapping to specific events
    if (typeof listener === "function") {
      listener = wrapSocketEventListener(event, listener, context);
    }

    return applyHandler();
  };
}

export function wrapSocketEventListener(
  event: string,
  listener: any,
  context: Context
): any {
  return async function wrappedListener() {
    // We need to call runWithContext again because the context of the connection handler is not passed to called event listeners
    return await runWithContext(context, async () => {
      const applyListener = () => {
        return listener.apply(
          // @ts-expect-error We don't now the type of this
          this,
          // eslint-disable-next-line prefer-rest-params
          arguments
        );
      };

      const context = getContext();
      if (!context) {
        return applyListener();
      }

      // Message event
      if (event === "message") {
        // eslint-disable-next-line prefer-rest-params
        await onMessageEvent(Array.from(arguments), context);
      }

      return applyListener();
    });
  };
}

export async function onMessageEvent(args: any[], context: Context) {
  if (!args.length) {
    return;
  }
  const data = args[0] as ArrayBuffer | Blob | Buffer | Buffer[];

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
