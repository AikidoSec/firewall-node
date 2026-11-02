import { getInstance } from "../agent/AgentSingleton";
import type { AICall } from "./parseAIResponse";

export function recordAICall(url: URL, call: AICall) {
  const agent = getInstance();
  if (!agent) {
    return;
  }

  agent.getAIStatistics().onAICall({
    provider: url.origin + url.pathname,
    ...call,
  });
}
