import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { getRouteForAiStats } from "../helpers/getRouteForAiStats";
import { isPlainObject } from "../helpers/isPlainObject";

type InvokeUsage = {
  input_tokens?: number;
  output_tokens?: number;
};

function isUsage(usage: unknown): usage is InvokeUsage {
  return (
    isPlainObject(usage) &&
    typeof usage.input_tokens === "number" &&
    typeof usage.output_tokens === "number"
  );
}

type InvokeResponse = {
  body?: Uint8Array;
};

function isInvokeResponse(response: unknown): response is InvokeResponse {
  return isPlainObject(response);
}

type ConverseUsage = {
  inputTokens?: number;
  outputTokens?: number;
};

function isConverseUsage(usage: unknown): usage is ConverseUsage {
  return (
    isPlainObject(usage) &&
    typeof usage.inputTokens === "number" &&
    typeof usage.outputTokens === "number"
  );
}

type ConverseResponse = {
  usage?: ConverseUsage;
};

function isConverseResponse(response: unknown): response is ConverseResponse {
  return isPlainObject(response);
}

export class AwsSDKVersion3 implements Wrapper {
  private processInvokeModelResponse(response: unknown, agent: Agent) {
    if (!isInvokeResponse(response)) {
      return;
    }

    let body;
    try {
      const json = new TextDecoder("utf-8", {
        fatal: true,
      }).decode(response.body);
      body = JSON.parse(json);
    } catch {
      // Ignore errors when parsing the response body
      return;
    }

    if (typeof body.model === "string") {
      let inputTokens = 0;
      let outputTokens = 0;

      if (isUsage(body.usage)) {
        inputTokens = body.usage.input_tokens;
        outputTokens = body.usage.output_tokens;
      }

      const aiStats = agent.getAIStatistics();
      aiStats.onAICall({
        provider: "bedrock",
        model: body.model,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        route: getRouteForAiStats(),
      });
    }
  }

  private processConverseResponse(
    response: unknown,
    command: unknown,
    agent: Agent
  ) {
    // @ts-expect-error We don't know the type of command
    if (!command || !command.input || !command.input.modelId) {
      return;
    }

    if (!isConverseResponse(response)) {
      return;
    }

    // @ts-expect-error We don't know the type of command
    const modelId: string = command.input.modelId;

    let inputTokens = 0;
    let outputTokens = 0;

    if (isConverseUsage(response.usage)) {
      inputTokens = response.usage.inputTokens || 0;
      outputTokens = response.usage.outputTokens || 0;
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "bedrock",
      model: modelId,
      inputTokens: inputTokens,
      outputTokens: outputTokens,
      route: getRouteForAiStats(),
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@aws-sdk/client-bedrock-runtime")
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => {
        if (exports.BedrockRuntimeClient) {
          wrapExport(exports.BedrockRuntimeClient.prototype, "send", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (args, returnValue, agent) => {
              if (args.length > 0) {
                const command = args[0];
                if (returnValue instanceof Promise) {
                  // Inspect the response after the promise resolves, it won't change the original promise
                  returnValue.then((response) => {
                    try {
                      if (
                        exports.InvokeModelCommand &&
                        command instanceof exports.InvokeModelCommand
                      ) {
                        this.processInvokeModelResponse(response, agent);
                      } else if (
                        exports.ConverseCommand &&
                        command instanceof exports.ConverseCommand
                      ) {
                        this.processConverseResponse(response, command, agent);
                      }
                    } catch {
                      // If we don't catch these errors, it will result in an unhandled promise rejection!
                    }
                  });
                }
              }

              return returnValue;
            },
          });
        }
      });
  }
}
