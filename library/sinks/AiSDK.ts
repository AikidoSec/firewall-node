/* eslint-disable max-lines-per-function */
import { Agent } from "../agent/Agent";
import type { Hooks } from "../agent/hooks/Hooks";
import { InterceptorObject, wrapExport } from "../agent/hooks/wrapExport";
import type { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

type PartialAiResponse = {
  usage: {
    completionTokens?: number;
    promptTokens?: number;
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
  };
  response: {
    modelId: string;
  };
};

export class AiSDK implements Wrapper {
  private inspectAiCall(agent: Agent, args: unknown[], response: unknown) {
    if (!this.isResult(response)) {
      return;
    }

    const provider = this.getProviderFromArgs(args);
    if (!provider) {
      return;
    }

    const modelName = this.getModelName(response);

    const usage = this.getUsage(response.usage);
    if (!usage) {
      return;
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: provider,
      model: modelName,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
  }

  private isResult(result: unknown): result is PartialAiResponse {
    if (
      result &&
      typeof result === "object" && // It is not a plain object
      !Array.isArray(result) &&
      "usage" in result &&
      isPlainObject(result.usage) &&
      "response" in result &&
      result.response &&
      isPlainObject(result.response) &&
      typeof result.response.modelId === "string"
    ) {
      return true;
    }
    return false;
  }

  private getProviderFromArgs(args: unknown[]): string | undefined {
    if (!Array.isArray(args) || args.length === 0) {
      return undefined;
    }

    const firstArg = args[0];
    if (!isPlainObject(firstArg)) {
      return undefined;
    }

    if (!firstArg.model || typeof firstArg.model !== "object") {
      return undefined;
    }

    if (
      !("provider" in firstArg.model) ||
      typeof firstArg.model.provider !== "string"
    ) {
      return undefined;
    }

    let providerName = firstArg.model.provider;

    if (providerName.includes(".")) {
      // e.g. google.generativeai
      providerName = providerName.split(".")[0];
    }

    if (providerName === "amazon-bedrock") {
      return "bedrock"; // Normalize amazon-bedrock to bedrock
    }

    if (providerName.includes("-")) {
      // e.g. azure-openai
      providerName = providerName.split("-")[0];
    }

    if (providerName === "google") {
      return "gemini"; // Normalize google to gemini
    }

    return providerName;
  }

  private getModelName(response: PartialAiResponse): string {
    let modelName = response.response.modelId;

    if (modelName.startsWith("models/")) {
      modelName = modelName.slice(7); // Remove "models/" prefix
    }

    return modelName;
  }

  private getUsage(usage: PartialAiResponse["usage"]):
    | {
        inputTokens: number;
        outputTokens: number;
      }
    | undefined {
    const inputTokens =
      (usage.inputTokens ?? 0) +
      (usage.promptTokens ?? 0) +
      (usage.reasoningTokens ?? 0);

    const outputTokens =
      (usage.outputTokens ?? 0) + (usage.completionTokens ?? 0);

    if (inputTokens === 0 && outputTokens === 0) {
      return undefined;
    }

    return {
      inputTokens,
      outputTokens,
    };
  }

  private getInterceptors(methodName: string): InterceptorObject {
    return {
      kind: "ai_op",
      modifyReturnValue: (args, returnValue, agent) => {
        if (returnValue instanceof Promise) {
          // Inspect the response after the promise resolves, it won't change the original promise
          returnValue
            .then((response) => {
              this.inspectAiCall(agent, args, response);
            })
            .catch((error) => {
              agent.onErrorThrownByInterceptor({
                error: error,
                method: `${methodName}.<promise>`,
                module: "ai",
              });
            });
        } else {
          try {
            this.inspectAiCall(agent, args, returnValue);
          } catch (error) {
            agent.onErrorThrownByInterceptor({
              error: error instanceof Error ? error : new Error(String(error)),
              method: methodName,
              module: "ai",
            });
          }
        }
        return returnValue;
      },
    };
  }

  private getStreamInterceptors(methodName: string): InterceptorObject {
    return {
      kind: "ai_op",
      modifyReturnValue: (args, returnValue, agent) => {
        if (
          !returnValue ||
          typeof returnValue !== "object" ||
          !("response" in returnValue) ||
          !(returnValue.response instanceof Promise) ||
          !("usage" in returnValue) ||
          !(returnValue.usage instanceof Promise)
        ) {
          return returnValue;
        }

        Promise.allSettled([returnValue.response, returnValue.usage])
          .then((promiseResults) => {
            const response =
              promiseResults[0].status === "fulfilled"
                ? promiseResults[0].value
                : undefined;
            const usage =
              promiseResults[1].status === "fulfilled"
                ? promiseResults[1].value
                : undefined;

            if (!response || !usage) {
              return;
            }

            this.inspectAiCall(agent, args, {
              response,
              usage,
            });
          })
          .catch((error) => {
            agent.onErrorThrownByInterceptor({
              error: error,
              method: `${methodName}.<promise>`,
              module: "ai",
            });
          });

        return returnValue;
      },
    };
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("ai")
      .withVersion("^6.0.0 || ^5.0.0 || ^4.0.0")
      .onRequire((exports, pkgInfo) => {
        // Can't wrap it directly because it's a readonly proxy
        const generateTextFunc = exports.generateText;
        const generateObjectFunc = exports.generateObject;
        const streamTextFunc = exports.streamText;
        const streamObjectFunc = exports.streamObject;

        return {
          ...exports,
          generateText: wrapExport(
            generateTextFunc,
            undefined,
            pkgInfo,
            this.getInterceptors("generateText")
          ),
          generateObject: wrapExport(
            generateObjectFunc,
            undefined,
            pkgInfo,
            this.getInterceptors("generateObject")
          ),
          streamText: wrapExport(
            streamTextFunc,
            undefined,
            pkgInfo,
            this.getStreamInterceptors("streamText")
          ),
          streamObject: wrapExport(
            streamObjectFunc,
            undefined,
            pkgInfo,
            this.getStreamInterceptors("streamObject")
          ),
        };
      })
      .addMultiFileInstrumentation(
        ["dist/index.js", "dist/index.mjs"],
        [
          {
            name: "generateText",
            nodeType: "FunctionDeclaration",
            operationKind: "ai_op",
            modifyReturnValue:
              this.getInterceptors("generateText").modifyReturnValue,
          },
          {
            name: "generateObject",
            nodeType: "FunctionDeclaration",
            operationKind: "ai_op",
            modifyReturnValue:
              this.getInterceptors("generateObject").modifyReturnValue,
          },
          {
            name: "streamText",
            nodeType: "FunctionDeclaration",
            operationKind: "ai_op",
            modifyReturnValue:
              this.getStreamInterceptors("streamText").modifyReturnValue,
          },
          {
            name: "streamObject",
            nodeType: "FunctionDeclaration",
            operationKind: "ai_op",
            modifyReturnValue:
              this.getStreamInterceptors("streamObject").modifyReturnValue,
          },
        ]
      );
  }
}
