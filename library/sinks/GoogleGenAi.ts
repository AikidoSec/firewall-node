import { Agent } from "../agent/Agent";
import type { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
import type { Wrapper } from "../agent/Wrapper";

type Response = {
  modelVersion: string;
  usageMetadata: {
    cachedContentTokenCount?: number;
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    responseTokenCount?: number;
    thoughtsTokenCount?: number;
    toolUsePromptTokenCount?: number;
  };
};

type InteractionResponse = {
  id: string;
  status: string;
  created: string;
  model?: string;
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
  };
};

export class GoogleGenAi implements Wrapper {
  private isResponse(response: unknown): response is Response {
    // Not possible to use isPlainObject because it is a class
    return (
      !!response &&
      typeof response === "object" &&
      !Array.isArray(response) &&
      "modelVersion" in response &&
      "usageMetadata" in response &&
      typeof response.usageMetadata === "object" &&
      response.usageMetadata !== null
    );
  }

  private getUsageMetadata(usage: Response["usageMetadata"]):
    | {
        inputTokens: number;
        outputTokens: number;
      }
    | undefined {
    const inputTokens =
      (usage.promptTokenCount ?? 0) +
      (usage.cachedContentTokenCount ?? 0) +
      (usage.toolUsePromptTokenCount ?? 0);

    const outputTokens =
      (usage.responseTokenCount ?? 0) +
      (usage.thoughtsTokenCount ?? 0) +
      (usage.candidatesTokenCount ?? 0);

    if (inputTokens === 0 && outputTokens === 0) {
      return;
    }

    return {
      inputTokens,
      outputTokens,
    };
  }

  private inspectReturnValue(agent: Agent, returnValue: any) {
    if (returnValue instanceof Promise) {
      // Inspect the response after the promise resolves, it won't change the original promise
      returnValue
        .then((response) => {
          this.inspectResponse(agent, response);
        })
        .catch((error) => {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: "generateContent.<promise>",
            module: "@google/genai",
          });
        });
    } else {
      try {
        // The new instrumentation wraps the return statements inside the async function
        // Inside an async function you can just return normal values (it's not a promise yet)
        this.inspectResponse(agent, returnValue);
      } catch (error) {
        agent.onErrorThrownByInterceptor({
          error: error instanceof Error ? error : new Error("Unknown error"),
          method: "generateContent",
          module: "@google/genai",
        });
      }
    }
  }

  private isInteractionResponse(
    response: unknown
  ): response is InteractionResponse {
    return (
      !!response &&
      typeof response === "object" &&
      !Array.isArray(response) &&
      "id" in response &&
      "status" in response &&
      "created" in response
    );
  }

  private inspectInteractionResponse(agent: Agent, response: any) {
    if (!this.isInteractionResponse(response)) {
      return;
    }

    const usage = response.usage;
    if (!usage) {
      return;
    }

    const inputTokens = usage.total_input_tokens ?? 0;
    const outputTokens = usage.total_output_tokens ?? 0;

    if (inputTokens === 0 && outputTokens === 0) {
      return;
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "google",
      model: response.model ?? "unknown",
      inputTokens,
      outputTokens,
    });
  }

  private inspectInteractionReturnValue(agent: Agent, returnValue: any) {
    if (returnValue instanceof Promise) {
      returnValue
        .then((response) => {
          this.inspectInteractionResponse(agent, response);
        })
        .catch((error) => {
          agent.onErrorThrownByInterceptor({
            error: error,
            method: "interactions.create.<promise>",
            module: "@google/genai",
          });
        });
    } else {
      try {
        this.inspectInteractionResponse(agent, returnValue);
      } catch (error) {
        agent.onErrorThrownByInterceptor({
          error: error instanceof Error ? error : new Error("Unknown error"),
          method: "interactions.create",
          module: "@google/genai",
        });
      }
    }
  }

  private inspectResponse(agent: Agent, response: any) {
    if (!this.isResponse(response)) {
      return;
    }

    const usage = this.getUsageMetadata(response.usageMetadata);
    if (!usage) {
      return;
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "google",
      model: response.modelVersion,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@google/genai")
      .withVersion("^1.6.0 || ^2.0.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "GoogleGenAI", pkgInfo, (instance) => {
          wrapExport(instance.models, "generateContent", pkgInfo, {
            kind: undefined,
            modifyReturnValue: (_args, returnValue, agent) => {
              this.inspectReturnValue(agent, returnValue);
              return returnValue;
            },
          });
          // Access getter once
          const interactions = instance.interactions;
          if (interactions && typeof interactions.create === "function") {
            wrapExport(interactions, "create", pkgInfo, {
              kind: undefined,
              modifyReturnValue: (_args, returnValue, agent) => {
                this.inspectInteractionReturnValue(agent, returnValue);
                return returnValue;
              },
            });
          }
        });

        return exports;
      })
      .addMultiFileInstrumentation(
        ["dist/node/index.cjs", "dist/node/index.mjs"],
        [
          {
            name: "this.generateContent",
            nodeType: "FunctionAssignment",
            operationKind: "ai_op",
            modifyReturnValue: (_args, returnValue, agent) => {
              this.inspectReturnValue(agent, returnValue);
              return returnValue;
            },
          },
          {
            name: "create",
            nodeType: "MethodDefinition",
            className: "BaseInteractions",
            operationKind: "ai_op",
            modifyReturnValue: (_args, returnValue, agent) => {
              this.inspectInteractionReturnValue(agent, returnValue);
              return returnValue;
            },
          },
        ]
      );
  }
}
