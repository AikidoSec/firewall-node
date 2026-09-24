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

type Provider = "openai" | "azure";

type ChatCompletionToolCall = {
  function?: {
    name: string;
  };
};

type ChatCompletionWithToolCalls = {
  choices?: Array<{
    message?: {
      tool_calls?: ChatCompletionToolCall[];
    };
  }>;
};

function isChatCompletionWithToolCalls(
  response: unknown
): response is ChatCompletionWithToolCalls {
  return isPlainObject(response) && Array.isArray(response.choices);
}

export class OpenAI implements Wrapper {
  private stripBlockedToolCalls(agent: Agent, response: unknown) {
    if (!isChatCompletionWithToolCalls(response)) {
      return;
    }

    const config = agent.getConfig();

    for (const choice of response.choices ?? []) {
      if (!choice.message || !Array.isArray(choice.message.tool_calls)) {
        continue;
      }

      choice.message.tool_calls = choice.message.tool_calls.filter(
        (toolCall) => {
          if (
            !toolCall.function ||
            typeof toolCall.function.name !== "string"
          ) {
            return true;
          }

          const { name } = toolCall.function;
          const blocked = config.isAIToolBlocked(name);
          agent.getAIStatistics().onAIToolCall({ name, blocked });

          return !blocked;
        }
      );
    }
  }

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
    });
  }

  // The AzureOpenAI client always sets a non-empty `apiVersion`
  // string on the client instance in its constructor (it throws if none is
  // given), while plain OpenAI clients never set this property.
  // See https://github.com/openai/openai-node/blob/master/src/azure.ts
  getProvider(subject: unknown): Provider {
    if (
      // @ts-expect-error We don't know the type of subject
      subject._client &&
      // @ts-expect-error We don't know the type of subject
      typeof subject._client.apiVersion === "string" &&
      // @ts-expect-error We don't know the type of subject
      subject._client.apiVersion.length > 0
    ) {
      return "azure";
    }

    return "openai";
  }

  private getResponsesClass(exports: any) {
    if (exports.Responses) {
      return exports.Responses; // v4
    }
    if (exports.OpenAI && exports.OpenAI.Responses) {
      return exports.OpenAI.Responses; // v5
    }
  }

  private getCompletionsClass(exports: any) {
    if (exports.Chat && exports.Chat.Completions) {
      return exports.Chat.Completions; // v4
    }
    if (
      exports.OpenAI &&
      exports.OpenAI.Chat &&
      exports.OpenAI.Chat.Completions
    ) {
      return exports.OpenAI.Chat.Completions; // v5
    }
  }

  private onResponseCreated(
    returnValue: unknown,
    agent: Agent,
    subject: unknown
  ) {
    if (returnValue instanceof Promise) {
      // Inspect the response after the promise resolves, it won't change the original promise
      returnValue
        .then((response) => {
          this.inspectResponse(agent, response, this.getProvider(subject));
        })
        .catch((error) => {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: "create.<promise>",
            module: "openai",
          });
        });
    }

    return returnValue;
  }

  private onCompletionsCreated(
    returnValue: unknown,
    agent: Agent,
    subject: unknown
  ) {
    if (returnValue instanceof Promise) {
      return returnValue.then((response) => {
        try {
          this.inspectCompletionResponse(
            agent,
            response,
            this.getProvider(subject)
          );
          this.stripBlockedToolCalls(agent, response);
        } catch (error: unknown) {
          agent.onErrorThrownByInterceptor({
            error: error instanceof Error ? error : new Error(String(error)),
            method: "create.<promise>",
            module: "openai",
          });
        }

        return response;
      });
    }

    return returnValue;
  }

  wrap(hooks: Hooks) {
    // Note: Streaming is not supported yet
    hooks
      .addPackage("openai")
      .withVersion("^5.0.0 || ^4.0.0 || ^6.0.0 || ^7.0.0")
      .onRequire((exports, pkgInfo) => {
        const responsesClass = this.getResponsesClass(exports);
        if (responsesClass) {
          wrapExport(responsesClass.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_args, returnValue, agent, subject) =>
              this.onResponseCreated(returnValue, agent, subject),
          });
        }

        const completionsClass = this.getCompletionsClass(exports);
        if (completionsClass) {
          wrapExport(completionsClass.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_args, returnValue, agent, subject) =>
              this.onCompletionsCreated(returnValue, agent, subject),
          });
        }
      })
      .addMultiFileInstrumentation(
        [
          "resources/responses/responses.js",
          "resources/responses/responses.mjs",
        ],
        [
          {
            name: "create",
            nodeType: "MethodDefinition",
            operationKind: "ai_op",
            modifyReturnValue: (_args, returnValue, agent, subject) =>
              this.onResponseCreated(returnValue, agent, subject),
          },
        ]
      )
      .addMultiFileInstrumentation(
        [
          "resources/chat/completions/completions.js",
          "resources/chat/completions/completions.mjs",
        ],
        [
          {
            name: "create",
            nodeType: "MethodDefinition",
            operationKind: "ai_op",
            modifyReturnValue: (_args, returnValue, agent, subject) =>
              this.onCompletionsCreated(returnValue, agent, subject),
          },
        ]
      );
  }
}
