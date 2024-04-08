import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";

export class Fetch implements Wrapper {
  inspectFetch(args: unknown[], agent: Agent) {
    if (args.length > 0) {
      if (typeof args[0] === "string" && args[0].length > 0) {
        try {
          const url = new URL(args[0]);
          if (url.hostname.length > 0) {
            agent.onConnectDomain(url.hostname);
          }
        } catch (e) {
          // Ignore
        }
      }

      if (args[0] instanceof URL && args[0].hostname.length > 0) {
        agent.onConnectDomain(args[0].hostname);
      }
    }
  }

  wrap(hooks: Hooks) {
    hooks
      .addGlobal("fetch")
      .inspect((args, subject, agent) => this.inspectFetch(args, agent));
  }
}
