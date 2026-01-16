import type { Agent } from "../../agent/Agent";
import { attackKindHumanName } from "../../agent/Attack";
import { getContext, updateContext } from "../../agent/Context";
import { cleanError } from "../../helpers/cleanError";
import { cleanupStackTrace } from "../../helpers/cleanupStackTrace";
import { isFeatureEnabled } from "../../helpers/featureFlags";
import { getLibraryRoot } from "../../helpers/getLibraryRoot";
import { AiMessage } from "./messages";

export async function checkForPromptInjection(
  agent: Agent,
  input: AiMessage[],
  pkgName: string,
  operation: string
): Promise<{
  success: boolean;
  block: boolean;
  error?: Error;
}> {
  if (!isFeatureEnabled("PROMPT_INJECTION_PROTECTION")) {
    return { success: false, block: false };
  }

  const context = getContext();
  if (context) {
    const matches = agent.getConfig().getEndpoints(context);

    if (matches.find((match) => match.forceProtectionOff)) {
      return { success: true, block: false };
    }
  }

  const isBypassedIP =
    context &&
    context.remoteAddress &&
    agent.getConfig().isBypassedIP(context.remoteAddress);

  if (isBypassedIP) {
    return { success: true, block: false };
  }

  try {
    const result = await agent.checkForPromptInjection(input);

    if (!result.success || !result.block) {
      return {
        success: false,
        block: false,
      };
    }

    if (context) {
      // Flag request as having an attack detected
      updateContext(context, "attackDetected", true);
    }

    agent.onDetectedAttack({
      module: pkgName,
      operation: operation,
      kind: "prompt_injection",
      source: undefined,
      blocked: agent.shouldBlock(),
      stack: cleanupStackTrace(new Error().stack!, getLibraryRoot()),
      paths: [],
      metadata: {
        prompt: messagesToString(input),
      },
      request: context,
      payload: undefined,
    });

    if (!agent.shouldBlock()) {
      return {
        success: result.success,
        block: false,
      };
    }

    return {
      success: result.success,
      block: result.block,
      error: cleanError(
        new Error(
          `Zen has blocked ${attackKindHumanName("prompt_injection")}: ${operation}(...)`
        )
      ),
    };
  } catch (e) {
    agent.log(`Prompt injection check failed: ${String(e)}`);
    return { success: false, block: false };
  }
}

function messagesToString(messages: AiMessage[]): string {
  return messages
    .map((msg) => {
      return `${msg.role}: ${msg.content}`;
    })
    .join("\n");
}
