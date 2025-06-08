/* eslint-disable max-lines-per-function */
import { Agent } from "../agent/Agent";
import { getContext } from "../agent/Context";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";

type ChatCompletionCreateParams = {
  model: string;
  messages: unknown[];
  [key: string]: unknown;
};

type ChatCompletionResponse = {
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  [key: string]: unknown;
};

export class OpenAI implements Wrapper {
  private trackAICall(
    args: unknown[],
    returnValue: unknown,
    agent: Agent
  ): unknown {
    const params = args[0] as ChatCompletionCreateParams;

    if (!params || typeof params !== "object" || !params.model) {
      return returnValue;
    }

    const model = params.model;
    const context = getContext();

    let inputTokens = 0;
    let outputTokens = 0;

    // Extract token counts from the response if available
    if (returnValue && typeof returnValue === "object") {
      // Handle both direct response and Promise
      const processResponse = (response: any) => {
        if (response && response.usage) {
          const usage = response.usage as ChatCompletionResponse["usage"];
          inputTokens = usage?.prompt_tokens || 0;
          outputTokens = usage?.completion_tokens || 0;
        }

        // Call onAICall to track statistics
        const aiStats = agent.getAIStatistics();
        aiStats.onAICall({
          provider: "openai",
          model: model,
          route:
            context && context.method && context.route
              ? {
                  path: context.route,
                  method: context.method,
                }
              : undefined,
          inputTokens,
          outputTokens,
        });

        return response;
      };

      // If it's a Promise (async response), handle it
      if (returnValue instanceof Promise) {
        return (returnValue as Promise<any>)
          .then(processResponse)
          .catch((error) => {
            // Track failed calls with zero tokens
            const aiStats = agent.getAIStatistics();
            aiStats.onAICall({
              provider: "openai",
              model: model,
              route:
                context && context.method && context.route
                  ? {
                      path: context.route,
                      method: context.method,
                    }
                  : undefined,
              inputTokens: 0,
              outputTokens: 0,
            });
            throw error;
          });
      } else {
        // Handle synchronous response
        return processResponse(returnValue);
      }
    }

    return returnValue;
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("openai")
      .withVersion("^4.0.0")
      .onRequire((exports, pkgInfo) => {
        // Wrap Chat Completions API
        if (
          exports.chat &&
          exports.chat.completions &&
          exports.chat.completions.create
        ) {
          wrapExport(exports.chat.completions, "create", pkgInfo, {
            kind: "llm_op",
            modifyReturnValue: (args, returnValue, agent) =>
              this.trackAICall(args, returnValue, agent),
          });
        }

        // Wrap Responses API (newer API)
        if (exports.responses && exports.responses.create) {
          wrapExport(exports.responses, "create", pkgInfo, {
            kind: "llm_op",
            modifyReturnValue: (args, returnValue, agent) =>
              this.trackAICall(args, returnValue, agent),
          });
        }
      });
  }
}
