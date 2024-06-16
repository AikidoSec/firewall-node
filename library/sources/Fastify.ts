import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";

export class Fastify implements Wrapper {
  private wrapArgs(args: unknown[], agent: Agent) {
    return args.map((arg) => {
      // Ignore non-function arguments
      if (typeof arg !== "function") {
        return arg;
      }

      // Todo
    });
  }

  wrap(hooks: Hooks) {
    const fastify = hooks.addPackage("fastify").withVersion("^4.0.0");
    // Todo
  }
}
