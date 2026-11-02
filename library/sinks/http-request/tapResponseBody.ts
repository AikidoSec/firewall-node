import type { IncomingMessage } from "http";
import type { AIResponseParser } from "../../ai-governance/AIResponseParser";
import { wrap } from "../../helpers/wrap";

export function tapResponseBody(
  response: IncomingMessage,
  parser: AIResponseParser
) {
  let finished = false;
  const pushDescriptor = Object.getOwnPropertyDescriptor(response, "push");

  const finish = (complete: boolean) => {
    if (finished) {
      return;
    }
    finished = true;
    try {
      response.removeListener("close", onClose);
      if (response.push === pushWrapper) {
        if (pushDescriptor) {
          Object.defineProperty(response, "push", pushDescriptor);
        } else {
          delete (response as Partial<IncomingMessage>).push;
        }
      }
      if (complete) {
        parser.end();
      } else {
        parser.destroy();
      }
    } catch {
      try {
        parser.destroy();
      } catch {
        return;
      }
    }
  };
  const onClose = () => finish(false);

  const pushWrapper = wrap(response, "push", (original) => {
    return function push(this: IncomingMessage, ...args: unknown[]) {
      const chunk = args[0];
      if (!finished && Buffer.isBuffer(chunk)) {
        try {
          parser.write(chunk);
        } catch {
          finish(false);
        }
      }
      const result = original.apply(this, args);
      if (chunk === null) {
        finish(true);
      }
      return result;
    };
  });
  response.once("close", onClose);
}
