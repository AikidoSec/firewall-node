import { getInstance } from "../agent/AgentSingleton";
import { lambda } from "../agent/protect";

export = lambda();

process.on("SIGTERM", () => {
  const agent = getInstance();

  if (!agent) {
    throw new Error("Agent not found!");
  }

  agent.flushStats().finally(() => {
    process.exit(0);
  });
});
