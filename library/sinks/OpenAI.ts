/* eslint-disable max-lines-per-function */
import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { InterceptorResult } from "../agent/hooks/InterceptorResult";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";
import { shouldBlockLLMCall } from "../vulnerabilities/prompt-injection/shouldBlockLLMCall";

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

type Message = {
  content: string;
  role: string;
};

function isMessage(message: unknown): message is Message {
  return (
    isPlainObject(message) &&
    "content" in message &&
    typeof message.content === "string" &&
    "role" in message &&
    typeof message.role === "string"
  );
}

function messagesToPrompt(messages: Message[]): string {
  return messages.map((msg) => msg.content).join("\n");
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
    returnValue: unknown,
    agent: Agent,
    subject: unknown
  ) {
    if (returnValue instanceof Promise) {
      // Inspect the response after the promise resolves, it won't change the original promise
      returnValue
        .then((response) => {
          this.inspectResponse(
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

  private async inspectCreateResponse(
    args: unknown[]
  ): Promise<InterceptorResult> {
    if (args.length === 0) {
      return;
    }

    const options = args[0];
    if (isPlainObject(options)) {
      let input: Message[] = [];
      if (typeof options.input === "string") {
        input = [{ role: "user", content: options.input }];
      }
      if (Array.isArray(options.input) && options.input.every(isMessage)) {
        input = options.input;
      }
      if (input.length > 0) {
        const decision = await shouldBlockLLMCall(messagesToPrompt(input));
        if (decision.block) {
          return {
            operation: "openai.responses.create",
            kind: "prompt-injection",
            source: "headers",
            pathsToPayload: [],
            metadata: {},
            payload: messagesToPrompt(input),
          };
        }
      }
    }
  }

  wrap(hooks: Hooks) {
    // Note: Streaming is not supported yet
    hooks
      .addPackage("openai")
      .withVersion("^5.0.0 || ^4.0.0")
      .onRequire((exports, pkgInfo) => {
        const responsesClass = this.getResponsesClass(exports);
        if (responsesClass) {
          wrapExport(responsesClass.prototype, "create", pkgInfo, {
            kind: "ai_op",
            asyncInspectArgs: async (args) => {
              return await this.inspectCreateResponse(args);
            },
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
