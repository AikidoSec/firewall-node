import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { PartialWrapPackageInfo } from "../agent/hooks/WrapPackageInfo";
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
  private processInvokeModelResponse(
    response: unknown,
    command: unknown,
    agent: Agent
  ) {
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

    // @ts-expect-error We don't know the type of command
    if (command && command.input && typeof command.input.modelId === "string") {
      let inputTokens = 0;
      let outputTokens = 0;

      if (isUsage(body.usage)) {
        inputTokens = body.usage.input_tokens;
        outputTokens = body.usage.output_tokens;
      }

      let modelId: string | undefined = undefined;
      // @ts-expect-error We don't know the type of command
      if (!command.input.modelId.startsWith("arn:")) {
        // @ts-expect-error We don't know the type of command
        modelId = command.input.modelId;
      }
      if (!modelId && typeof body.model === "string") {
        modelId = body.model;
      }

      if (!modelId) {
        return;
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

    // Don't report if modelId is an ARN
    // There's no way to get the actual model name like we can with InvokeModel
    if (modelId.startsWith("arn:")) {
      return;
    }

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

  onRequire(exports: any, pkgInfo: PartialWrapPackageInfo) {
    if (exports.BedrockRuntimeClient) {
      wrapExport(exports.BedrockRuntimeClient.prototype, "send", pkgInfo, {
        kind: "ai_op",
        modifyReturnValue: (args, returnValue, agent) => {
          if (args.length > 0) {
            const command = args[0];
            if (returnValue instanceof Promise) {
              // Inspect the response after the promise resolves, it won't change the original promise
              returnValue
                .then((response) => {
                  if (
                    exports.InvokeModelCommand &&
                    command instanceof exports.InvokeModelCommand
                  ) {
                    this.processInvokeModelResponse(response, command, agent);
                  } else if (
                    exports.ConverseCommand &&
                    command instanceof exports.ConverseCommand
                  ) {
                    this.processConverseResponse(response, command, agent);
                  }
                })
                .catch((error) => {
                  agent.onErrorThrownByInterceptor({
                    error: error,
                    method: "send.<promise>",
                    module: "@aws-sdk/client-bedrock-runtime",
                  });
                });
            }
          }

          return returnValue;
        },
      });
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@aws-sdk/client-bedrock-runtime")
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => {
        this.onRequire(exports, pkgInfo);
      })
      // ESM instrumentation not added yet
      // because the package.json "main" field points to CJS build
      // and "module" is not supported by Node.js:
      // "module": "./dist-es/index.js",
      .addFileInstrumentation({
        path: "dist-cjs/index.js",
        functions: [],
        accessLocalVariables: {
          names: ["module.exports"],
          cb: (vars, pkgInfo) => {
            if (vars.length > 0 && isPlainObject(vars[0])) {
              this.onRequire(vars[0], pkgInfo);
            }
          },
        },
      });
  }
}
