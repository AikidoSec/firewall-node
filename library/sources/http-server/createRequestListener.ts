import type { IncomingMessage, OutgoingMessage, RequestListener } from "http";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";

export function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent
): RequestListener {
  return function requestListener(req, res) {
    const context = contextFromRequest(req, module);

    runWithContext(context, () => {
      res.on("finish", () => {
        const context = getContext();
        agent.getInspectionStatistics().onRequest();
        if (context && context.attackDetected) {
          agent.getInspectionStatistics().onDetectedAttack({
            blocked: agent.shouldBlock(),
          });
        }
      });

      return listener(req, res);
    });
  };
}
