import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { Wrapper } from "../agent/Wrapper";
import { wrapHandleUpgradeCallback } from "./ws/wrapHandleUpgrade";

export class Ws implements Wrapper {
  private wrapUpgrade(args: unknown[], agent: Agent) {
    if (args.length < 4 || typeof args[3] !== "function") {
      return args;
    }

    args[3] = wrapHandleUpgradeCallback(args[3], agent);

    return args;
  }

  wrap(hooks: Hooks) {
    const ws = hooks.addPackage("ws").withVersion("^8.0.0 || ^7.0.0");
    const exports = ws.addSubject((exports) => exports);

    const subjects = [
      exports
        .inspectNewInstance("WebSocketServer")
        .addSubject((exports) => exports),
      exports.inspectNewInstance("Server").addSubject((exports) => exports),
    ];

    for (const subject of subjects) {
      subject.modifyArguments("handleUpgrade", (args, subject, agent) => {
        return this.wrapUpgrade(args, agent);
      });
    }
  }
}
