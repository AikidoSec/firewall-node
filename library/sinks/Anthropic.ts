import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapExport } from "../agent/hooks/wrapExport";
import { isPlainObject } from "../helpers/isPlainObject";

// See https://docs.anthropic.com/claude/reference/messages_post
type AnthropicMessageResponse = {
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
};

function isAnthropicMessageResponse(
  obj: unknown
): obj is AnthropicMessageResponse {
  if (!isPlainObject(obj)) {
    return false;
  }

  if (typeof obj.model !== "string") {
    return false;
  }

  if (obj.usage !== undefined) {
    if (!isPlainObject(obj.usage)) {
      return false;
    }

    if (
      typeof obj.usage.input_tokens !== "number" ||
      typeof obj.usage.output_tokens !== "number"
    ) {
      return false;
    }
  }

  return true;
}

export class Anthropic implements Wrapper {
  private inspectResponse(agent: Agent, response: unknown) {
    if (!isAnthropicMessageResponse(response)) {
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    if (response.usage) {
      inputTokens = response.usage.input_tokens;
      outputTokens = response.usage.output_tokens;
    }

    const aiStats = agent.getAIStatistics();
    aiStats.onAICall({
      provider: "anthropic",
      model: response.model ?? "",
      inputTokens: inputTokens,
      outputTokens: outputTokens,
    });
  }

  wrap(hooks: Hooks) {
    hooks
      .addPackage("@anthropic-ai/sdk")
      .withVersion("^0.20.0")
      .onRequire((exports, pkgInfo) => {
        if (
          exports.Messages &&
          exports.Messages.prototype &&
          exports.Messages.prototype
        ) {
          wrapExport(exports.Messages.prototype, "create", pkgInfo, {
            kind: "ai_op",
            modifyReturnValue: (_, returnValue, agent) => {
              if (returnValue instanceof Promise) {
                // Inspect the response after the promise resolves
                returnValue.then((response) => {
                  try {
                    this.inspectResponse(agent, response);
                  } catch {
                    // If we don't catch these errors, it will result in an unhandled promise rejection!
                  }
                });
              }

              return returnValue;
            },
          });
        }
      });
  }
}
