import type { Agent } from "../../agent/Agent";
import { AiMessage } from "./messages";

export async function checkForPromptInjection(
  agent: Agent,
  input: AiMessage[]
): Promise<{
  success: boolean;
  block: boolean;
}> {
  // Todo Check if prompt includes user input?

  try {
    const result = await agent.checkForPromptInjection(input);

    // Todo: Enhance result with prompt details
    // Source of payload
    return {
      success: result.success,
      block: result.block,
    };
  } catch (e) {
    agent.log(`Prompt injection check failed: ${String(e)}`);
    return { success: false, block: false };
  }
}
