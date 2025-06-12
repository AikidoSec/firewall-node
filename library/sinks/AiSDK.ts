import { Agent } from "../agent/Agent";
import type { Hooks } from "../agent/hooks/Hooks";
import { InterceptorObject, wrapExport } from "../agent/hooks/wrapExport";
import type { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

type PartialAiResponse = {
  usage: {
    completionTokens: number;
    promptTokens: number;
    totalTokens: number;
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

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: provider,
      model: modelName,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
    });
  }

  private isResult(result: unknown): result is PartialAiResponse {
    if (
      result &&
      typeof result === "object" && // It is not a plain object
      !Array.isArray(result) &&
      "usage" in result &&
      isPlainObject(result.usage) &&
      typeof result.usage.completionTokens === "number" &&
      typeof result.usage.promptTokens === "number" &&
      typeof result.usage.totalTokens === "number" &&
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

  wrap(hooks: Hooks) {
    const interceptors: InterceptorObject = {
      kind: "ai_op",
      modifyReturnValue: (args, returnValue, agent) => {
        if (returnValue instanceof Promise) {
          // Inspect the response after the promise resolves, it won't change the original promise
          returnValue.then((response) => {
            try {
              this.inspectAiCall(agent, args, response);
            } catch {
              // If we don't catch these errors, it will result in an unhandled promise rejection!
            }
          });
        }
        return returnValue;
      },
    };

    hooks
      .addPackage("ai")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        // Can't wrap it directly because it's a readonly proxy
        const generateTextFunc = exports.generateText;
        const generateObjectFunc = exports.generateObject;

        return {
          ...exports,
          generateText: wrapExport(
            generateTextFunc,
            undefined,
            pkgInfo,
            interceptors
          ),
          generateObject: wrapExport(
            generateObjectFunc,
            undefined,
            pkgInfo,
            interceptors
          ),
        };
      });
  }
}
