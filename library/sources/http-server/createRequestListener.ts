import type { IncomingMessage, OutgoingMessage, RequestListener } from "http";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import { readBodyStream } from "./readBodyStream";

export function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent,
  readBody: boolean
): RequestListener {
  return async function requestListener(req, res) {
    if (!readBody) {
      return callListenerWithContext(listener, req, res, module, agent, "");
    }

    const result = await readBodyStream(req, res, agent);

    if (!result.success) {
      return;
    }

    return callListenerWithContext(
      listener,
      req,
      res,
      module,
      agent,
      result.body
    );
  };
}

function callListenerWithContext(
  listener: Function,
  req: IncomingMessage,
  res: OutgoingMessage,
  module: string,
  agent: Agent,
  body: string
) {
  const context = contextFromRequest(req, body, module);

  return runWithContext(context, () => {
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
}
