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
      .withVersion("^1.6.0")
      .onRequire((exports, pkgInfo) => {
        wrapNewInstance(exports, "GoogleGenAI", pkgInfo, (instance) => {
          wrapExport(instance.models, "generateContent", pkgInfo, {
            kind: undefined,
            modifyReturnValue: (args, returnValue, agent) => {
              this.inspectReturnValue(agent, returnValue);
              return returnValue;
            },
          });
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
            modifyReturnValue: (args, returnValue, agent) => {
              this.inspectReturnValue(agent, returnValue);
              return returnValue;
            },
          },
        ]
      );
  }
}
