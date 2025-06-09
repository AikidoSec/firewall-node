import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";

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

  private inspectCompletionsResponse(agent: Agent, completion: unknown) {
    if (!isCompletionResponse(completion)) {
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    if (completion.usage) {
      if (typeof completion.usage.prompt_tokens === "number") {
        inputTokens = completion.usage.prompt_tokens;
      }
      if (typeof completion.usage.completion_tokens === "number") {
        outputTokens = completion.usage.completion_tokens;
      }
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "openai",
      model: completion.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
    });
  }

  wrap(hooks: Hooks) {
    // Note: Streaming is not supported yet
    // Note: Azure OpenAI is not supported yet
    hooks
      .addPackage("openai")
      .withVersion("^4.0.0")
      .onFileRequire("resources/responses/responses.js", (exports, pkgInfo) => {
        wrapNewInstance(exports, "Responses", pkgInfo, (instance) => {
          wrapExport(instance, "create", pkgInfo, {
            kind: "llm_op",
            modifyReturnValue: (args, returnValue, agent) => {
              if (returnValue instanceof Promise) {
                returnValue.then((response) => {
                  this.inspectResponse(agent, response);
                });
              }

              return returnValue;
            },
          });
        });
      });
  }
}
