import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { Wrapper } from "../agent/Wrapper";
import { isPlainObject } from "../helpers/isPlainObject";

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
};

function isUsage(usage: unknown): usage is Usage {
  return (
    isPlainObject(usage) &&
    typeof usage.input_tokens === "number" &&
    typeof usage.output_tokens === "number"
  );
}

type Response = {
  body?: Uint8Array;
};

function isResponse(response: unknown): response is Response {
  return isPlainObject(response);
}

export class AwsSDKVersion3 implements Wrapper {
  private processResponse(response: unknown, agent: Agent) {
    if (!isResponse(response)) {
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
        provider: "aws-bedrock",
        model: body.model,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
      });
    }
  }

  wrap(hooks: Hooks) {
    // Note: Converse command is not supported yet
    hooks
      .addPackage("@aws-sdk/client-bedrock-runtime")
      .withVersion("^3.0.0")
      .onRequire((exports, pkgInfo) => {
        if (exports.BedrockRuntimeClient && exports.InvokeModelCommand) {
          wrapExport(exports.BedrockRuntimeClient.prototype, "send", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (args, returnValue, agent) => {
              if (args.length > 0) {
                if (
                  returnValue instanceof Promise &&
                  args[0] instanceof exports.InvokeModelCommand
                ) {
                  returnValue.then((response) => {
                    this.processResponse(response, agent);
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
