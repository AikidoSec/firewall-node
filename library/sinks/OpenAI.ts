import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";

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

export class OpenAI implements Wrapper {
  private inspectResponse(agent: Agent, response: unknown) {
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
      provider: "openai",
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
    });
  }

  private inspectCompletionResponse(agent: Agent, response: unknown) {
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
      provider: "openai",
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
    });
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
            modifyReturnValue: (args, returnValue, agent) => {
              if (returnValue instanceof Promise) {
                // Inspect the response after the promise resolves, it won't change the original promise
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

        if (exports.Completions) {
          wrapExport(exports.Completions.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (args, returnValue, agent) => {
              if (returnValue instanceof Promise) {
                // Inspect the response after the promise resolves, it won't change the original promise
                returnValue.then((response) => {
                  try {
                    this.inspectCompletionResponse(agent, response);
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
