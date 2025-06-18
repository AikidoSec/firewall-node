import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";
import { getRouteForAiStats } from "../helpers/getRouteForAIStats";

type Response = {
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};

function isResponse(response: unknown): response is Response {
  return (
    isPlainObject(response) &&
    "model" in response &&
    typeof response.model === "string"
  );
}

// See https://platform.openai.com/docs/api-reference/chat/object
type CompletionResponse = {
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
};

function isCompletionResponse(
  response: unknown
): response is CompletionResponse {
  return (
    isPlainObject(response) &&
    "model" in response &&
    typeof response.model === "string"
  );
}

type Provider = "openai" | "azure";

export class OpenAI implements Wrapper {
  private inspectResponse(agent: Agent, response: unknown, provider: Provider) {
    if (!isResponse(response)) {
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    if (response.usage) {
      if (typeof response.usage.input_tokens === "number") {
        inputTokens = response.usage.input_tokens;
      }
      if (typeof response.usage.output_tokens === "number") {
        outputTokens = response.usage.output_tokens;
      }
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: provider,
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      route: getRouteForAiStats(),
    });
  }

  private inspectCompletionResponse(
    agent: Agent,
    response: unknown,
    provider: Provider
  ) {
    if (!isCompletionResponse(response)) {
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    if (response.usage) {
      if (typeof response.usage.prompt_tokens === "number") {
        inputTokens = response.usage.prompt_tokens;
      }
      if (typeof response.usage.completion_tokens === "number") {
        outputTokens = response.usage.completion_tokens;
      }
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: provider,
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      route: getRouteForAiStats(),
    });
  }

  // The _client property is used to determine if the OpenAI client is an Azure OpenAI client or not.
  // See https://github.com/openai/openai-node/blob/master/src/core/resource.ts
  getProvider(exports: unknown, subject: unknown): Provider {
    if (
      // @ts-expect-error We don't know the type of exports
      exports.AzureOpenAI &&
      // @ts-expect-error We don't know the type of subject
      subject._client &&
      // @ts-expect-error We don't know the type of subject
      subject._client instanceof exports.AzureOpenAI
    ) {
      return "azure";
    }

    return "openai";
  }

  wrap(hooks: Hooks) {
    // Note: Streaming is not supported yet
    hooks
      .addPackage("openai")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        if (exports.Responses) {
          wrapExport(exports.Responses.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_, returnValue, agent, subject) => {
              if (returnValue instanceof Promise) {
                // Inspect the response after the promise resolves, it won't change the original promise
                returnValue.then((response) => {
                  try {
                    this.inspectResponse(
                      agent,
                      response,
                      this.getProvider(exports, subject)
                    );
                  } catch {
                    // If we don't catch these errors, it will result in an unhandled promise rejection!
                  }
                });
              }

              return returnValue;
            },
          });
        }

        if (exports.Chat.Completions) {
          wrapExport(exports.Chat.Completions.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_, returnValue, agent, subject) => {
              if (returnValue instanceof Promise) {
                // Inspect the response after the promise resolves, it won't change the original promise
                returnValue.then((response) => {
                  try {
                    this.inspectCompletionResponse(
                      agent,
                      response,
                      this.getProvider(exports, subject)
                    );
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
