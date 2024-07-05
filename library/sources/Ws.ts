import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapConnectionHandler } from "./ws/wrapConnectionHandler";

export class Ws implements Wrapper {
  private wrapEventArgs(args: unknown[], agent: Agent) {
    console.log("args", args);

    if (
      args.length < 2 ||
      typeof args[0] !== "string" ||
      typeof args[1] !== "function"
    ) {
      return args;
    }

    if (args[0] === "connection") {
      args[1] = wrapConnectionHandler(args[1], agent);
    }

    return args;
  }

  wrap(hooks: Hooks) {
    const ws = hooks.addPackage("ws").withVersion("^8.0.0"); // Todo add versions
    const exports = ws.addSubject((exports) => exports);

    const subjects = [
      exports
        .inspectNewInstance("WebSocketServer")
        .addSubject((exports) => exports),
      exports.inspectNewInstance("Server").addSubject((exports) => exports),
    ];

    for (const subject of subjects) {
      subject.modifyArguments("on", (args, subject, agent) => {
        return this.wrapEventArgs(args, agent);
      });
    }
  }
}
