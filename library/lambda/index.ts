import { getInstance } from "../agent/AgentSingleton";
import { lambda } from "../agent/protect";

export = lambda();

process.on("SIGTERM", () => {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  agent.flushStats(1000);
});
