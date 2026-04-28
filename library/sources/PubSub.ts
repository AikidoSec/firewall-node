import { runWithContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import type { Message } from "@google-cloud/pubsub";
import { tryParseJSON } from "../helpers/tryParseJSON";

export class PubSub implements Wrapper {
  private wrapMessageHandler(args: unknown[]) {
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
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@google-cloud/pubsub")
      .withVersion("^5.0.0 || ^4.0.0")
      .onFileRequire("build/src/subscription.js", (exports, pkgInfo) => {
        wrapExport(exports.Subscription.prototype, "on", pkgInfo, {
          kind: undefined,
          modifyArgs: this.wrapMessageHandler,
        });
      })
      .addFileInstrumentation({
        path: "build/src/subscription.js",
        functions: [
          {
            name: "constructor",
            nodeType: "MethodDefinition",
            operationKind: undefined,
            inspectArgs: (args, agent, subscription) => {
              wrapExport(
                subscription,
                "on",
                {
                  name: "@google-cloud/pubsub",
                  type: "external",
                },
                {
                  kind: undefined,
                  modifyArgs: this.wrapMessageHandler,
                }
              );
            },
          },
        ],
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
