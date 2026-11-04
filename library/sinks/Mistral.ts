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
    cached_tokens?: number;
    additionalProperties?: {
      cached_tokens?: number;
    };
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
    let cacheReadTokens = 0;
    if (response.usage) {
      if (typeof response.usage.promptTokens === "number") {
        inputTokens = response.usage.promptTokens;
      }
      if (typeof response.usage.completionTokens === "number") {
        outputTokens = response.usage.completionTokens;
      }
      if (typeof response.usage.cached_tokens === "number") {
        cacheReadTokens = response.usage.cached_tokens;
      } else if (
        typeof response.usage.additionalProperties?.cached_tokens === "number"
      ) {
        cacheReadTokens = response.usage.additionalProperties.cached_tokens;
      }
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "mistral",
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      cacheReadTokens,
    });
  }

  private inspectPromise(returnValue: unknown, agent: Agent) {
    if (returnValue instanceof Promise) {
      // Inspect the response after the promise resolves
      returnValue
        .then((response) => {
          this.inspectResponse(agent, response);
        })
        .catch((error) => {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: "complete.<promise>",
            module: "@mistralai/mistralai",
          });
        });
    }
  }

  wrap(hooks: Hooks) {
    const pkg = hooks.addPackage("@mistralai/mistralai");

    pkg
      .withVersion("^1.0.0")
      .onRequire((exports, pkgInfo) => {
        if (
          exports.Mistral &&
          exports.Mistral.prototype &&
          exports.Mistral.prototype.chat
        ) {
          wrapExport(exports.Mistral.prototype.chat, "complete", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_, returnValue, agent) => {
              this.inspectPromise(returnValue, agent);
              return returnValue;
            },
          });
        }
      })
      .addFileInstrumentation({
        path: "sdk/chat.js",
        functions: [
          {
            name: "complete",
            operationKind: "ai_op",
            nodeType: "MethodDefinition",
            modifyReturnValue: (_, returnValue, agent) => {
              this.inspectPromise(returnValue, agent);
              return returnValue;
            },
          },
        ],
      });

    pkg.withVersion("^2.0.0").addFileInstrumentation({
      path: "esm/sdk/chat.js",
      functions: [
        {
          name: "complete",
          operationKind: "ai_op",
          nodeType: "MethodDefinition",
          modifyReturnValue: (_, returnValue, agent) => {
            this.inspectPromise(returnValue, agent);
            return returnValue;
          },
        },
      ],
    });
  }
}
