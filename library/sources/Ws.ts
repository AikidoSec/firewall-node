import { Agent } from "../agent/Agent";
import { Hooks } from "../agent/hooks/Hooks";
import { wrapExport } from "../agent/hooks/wrapExport";
import { wrapNewInstance } from "../agent/hooks/wrapNewInstance";
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
    hooks
      .addPackage("ws")
      .withVersion("^8.0.0 || ^7.0.0")
      .onRequire((exports, pkgInfo) => {
        for (const server of ["WebSocketServer", "Server"]) {
          wrapNewInstance(exports, server, pkgInfo, (instance) => {
            wrapExport(instance, "handleUpgrade", pkgInfo, {
              modifyArgs: (args, agent) => this.wrapUpgrade(args, agent),
            });
          });
        }
      });
  }
}
