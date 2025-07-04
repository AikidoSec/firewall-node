import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";

// See https://github.com/mistralai/client-ts/blob/main/src/models/components/chatcompletionresponse.ts
type MistralChatCompletionResponse = {
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
};

function isMistralChatCompletionResponse(
  response: unknown
): response is MistralChatCompletionResponse {
  return (
    isPlainObject(response) &&
    "model" in response &&
    typeof response.model === "string"
  );
}

export class Mistral implements Wrapper {
  private inspectResponse(agent: Agent, response: unknown) {
    if (!isMistralChatCompletionResponse(response)) {
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    if (response.usage) {
      if (typeof response.usage.promptTokens === "number") {
        inputTokens = response.usage.promptTokens;
      }
      if (typeof response.usage.completionTokens === "number") {
        outputTokens = response.usage.completionTokens;
      }
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "mistral",
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@mistralai/mistralai")
      .withVersion("^1.0.0")
      .onRequire((exports, pkgInfo) => {
        // We need to wrap the chat.complete method
        // Based on the usage: mistral.chat.complete()
        if (
          exports.Mistral &&
          exports.Mistral.prototype &&
          exports.Mistral.prototype.chat
        ) {
          wrapExport(exports.Mistral.prototype.chat, "complete", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_, returnValue, agent) => {
              if (returnValue instanceof Promise) {
                // Inspect the response after the promise resolves
                returnValue.then((response) => {
                  try {
                    this.inspectResponse(agent, response);
                  } catch {
                    // If we don't catch these errors, it will result in an unhandled promise rejection!
                  }
                });
              }

              return returnValue;
            },
          });
        }
      });
  }
}
