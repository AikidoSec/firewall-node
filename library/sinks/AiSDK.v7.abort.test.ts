import * as t from "tap";
import { setImmediate } from "node:timers/promises";
import { MockLanguageModelV3 } from "ai-v7/test";
import { startTestAgent } from "../helpers/startTestAgent";
import { AiSDK } from "./AiSDK";

t.test(
  "does not cause an unhandled rejection when streamText is aborted",
  async (t) => {
    startTestAgent({
      wrappers: [new AiSDK()],
      rewrite: {
        ai: "ai-v7",
      },
    });

    const { streamText } = require("ai-v7") as typeof import("ai-v7");
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on("unhandledRejection", onUnhandledRejection);
    t.teardown(() => {
      process.off("unhandledRejection", onUnhandledRejection);
    });

    let resolveStreamStarted: (() => void) | undefined;
    const streamStarted = new Promise<void>((resolve) => {
      resolveStreamStarted = resolve;
    });
    const controller = new AbortController();
    const result = streamText({
      model: new MockLanguageModelV3({
        doStream: async ({ abortSignal }) => ({
          stream: new ReadableStream({
            start(streamController) {
              resolveStreamStarted?.();
              abortSignal?.addEventListener(
                "abort",
                () => streamController.error(abortSignal.reason),
                { once: true }
              );
            },
          }),
        }),
      }),
      prompt: "hello",
      abortSignal: controller.signal,
    });

    const consumeStream = result.consumeStream();
    await streamStarted;
    controller.abort(new Error("stream aborted"));
    await consumeStream;
    await setImmediate();

    t.same(unhandledRejections, []);
  }
);
