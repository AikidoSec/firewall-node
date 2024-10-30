import { runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import type { Message } from "@google-cloud/pubsub";

export class PubSub implements Wrapper {
  wrap(hooks: Hooks) {
    hooks
      .addPackage("@google-cloud/pubsub")
      .withVersion("^4.0.0")
      .onFileRequire("build/src/subscription.js", (exports, pkgInfo) => {
        wrapExport(exports.Subscription.prototype, "on", pkgInfo, {
          modifyArgs: (args) => {
            if (
              args.length > 0 &&
              typeof args[0] === "string" &&
              args[0] === "message" &&
              typeof args[1] === "function"
            ) {
              const originalCallback = args[1];
              args[1] = handleMessage(originalCallback);
            }

            return args;
          },
        });
      });
  }
}

function handleMessage(handler: Function) {
  return function handleMessage(...args: unknown[]) {
    let body = undefined;

    if (args.length > 0) {
      const message = args[0] as Message;
      if (message && message.data) {
        body = tryParseJSON(message.data.toString());
      }
    }

    return runWithContext(
      {
        body: body,
        method: undefined,
        remoteAddress: undefined,
        url: undefined,
        headers: {},
        cookies: {},
        query: {},
        routeParams: {},
        source: "pubsub",
        route: undefined,
      },
      () => {
        return handler(...args);
      }
    );
  };
}

function tryParseJSON(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return undefined;
  }
}
