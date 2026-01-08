/* eslint-disable max-lines-per-function */
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";
import {
  type AiMessage,
  isAiMessagesArray,
} from "../vulnerabilities/prompt-injection/messages";
import { checkForPromptInjection } from "../vulnerabilities/prompt-injection/checkForPromptInjection";

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
    args: unknown[],
    returnValue: unknown,
    agent: Agent,
    subject: unknown
  ) {
    if (returnValue instanceof Promise) {
      const messages = this.getMessagesFromArgs(args);
      if (!messages || !isAiMessagesArray(messages)) {
        return returnValue;
      }

      const pendingCheck = checkForPromptInjection(agent, messages);

      return new Promise((resolve, reject) => {
        returnValue.then(async (response) => {
          const promptCheckResult = await pendingCheck;
          if (promptCheckResult.block) {
            // Todo capture Event etc. like in other sinks

            return reject(
              new Error("Prompt injection detected in AI response. WIP!")
            );
          }

          resolve(response);

          try {
            this.inspectResponse(
              agent,
              response,
              this.getProvider(exports, subject)
            );
          } catch (error) {
            agent.onErrorThrownByInterceptor({
              error: error instanceof Error ? error : new Error(String(error)),
              method: "create.<promise>",
              module: "openai",
            });
          }
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
      // Inspect the response after the promise resolves, it won't change the original promise
      returnValue
        .then((response) => {
          this.inspectCompletionResponse(
            agent,
            response,
            this.getProvider(exports, subject)
          );
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

  private getMessagesFromArgs(args: unknown[]): AiMessage[] | undefined {
    if (args.length === 0) {
      return undefined;
    }

    const options = args[0];
    if (isPlainObject(options)) {
      const messages: AiMessage[] = [];

      if (isAiMessagesArray(options.input)) {
        messages.push(...options.input);
      }

      if (typeof options.input === "string") {
        messages.push({ role: "user", content: options.input });
      }

      if (typeof options.instructions === "string") {
        messages.push({ role: "system", content: options.instructions });
      }

      return messages.length > 0 ? messages : undefined;
    }
  }

  wrap(hooks: Hooks) {
    // Note: Streaming is not supported yet
    hooks
      .addPackage("openai")
      .withVersion("^5.0.0 || ^4.0.0 || ^6.0.0")
      .onRequire((exports, pkgInfo) => {
        const responsesClass = this.getResponsesClass(exports);
        if (responsesClass) {
          wrapExport(responsesClass.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (args, returnValue, agent, subject) =>
              this.onResponseCreated(args, returnValue, agent, subject),
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
            modifyReturnValue: (args, returnValue, agent, subject) =>
              this.onResponseCreated(args, returnValue, agent, subject),
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
