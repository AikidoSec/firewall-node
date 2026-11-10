import { getInstance } from "../agent/AgentSingleton";
import { createSafeObject } from "../helpers/createSafeObject";
import type { AICall } from "./parseAIResponse";

export function recordAICall(url: URL, call: AICall) {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  agent
    .getAIStatistics()
    .onAICall(createSafeObject({ provider: url.origin }, call));
}
