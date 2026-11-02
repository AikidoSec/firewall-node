import type { IncomingMessage } from "http";
import type { AIResponseParser } from "../../ai-governance/AIResponseParser";

export function tapResponseBody(
  response: IncomingMessage,
  parser: AIResponseParser
) {
  let finished = false;
  let dataListenerAdded = false;
  let readWrapper: IncomingMessage["read"] | undefined;
  let readDescriptor: PropertyDescriptor | undefined;

  const cleanup = () => {
    response.removeListener("newListener", onNewListener);
    response.removeListener("data", collectChunk);
    response.removeListener("end", onEnd);
    response.removeListener("close", onClose);
    if (readWrapper && response.read === readWrapper) {
      if (readDescriptor) {
        Object.defineProperty(response, "read", readDescriptor);
      } else {
        Reflect.deleteProperty(response, "read");
      }
    }
  };

  const finish = (complete: boolean) => {
    if (finished) {
      return;
    }
    finished = true;
    try {
      cleanup();
      if (complete) {
        parser.end();
      } else {
        parser.destroy();
      }
    } catch {
      parser.destroy();
    }
  };
  const onEnd = () => finish(true);
  const onClose = () => finish(false);

  const collectChunk = (chunk: unknown) => {
    if (finished) {
      return;
    }
    try {
      if (Buffer.isBuffer(chunk)) {
        parser.write(chunk);
      } else if (typeof chunk === "string") {
        parser.write(Buffer.from(chunk, response.readableEncoding ?? "utf8"));
      }
    } catch {
      onClose();
    }
  };

  const onNewListener = (event: string | symbol) => {
    try {
      if (event === "data" && !dataListenerAdded) {
        dataListenerAdded = true;
        response.on("data", collectChunk);
      } else if (event === "readable" && !readWrapper && !dataListenerAdded) {
        const originalRead = response.read;
        readDescriptor = Object.getOwnPropertyDescriptor(response, "read");
        readWrapper = function read(this: IncomingMessage, ...args) {
          const chunk: unknown = Reflect.apply(originalRead, this, args);
          if (!dataListenerAdded) {
            collectChunk(chunk);
          }
          return chunk;
        };
        response.read = readWrapper;
      }
    } catch {
      onClose();
    }
  };

  response.on("newListener", onNewListener);
  response.once("end", onEnd);
  response.once("close", onClose);
}
