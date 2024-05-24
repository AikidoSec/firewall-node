import type { IncomingMessage, OutgoingMessage, RequestListener } from "http";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { getCloneableBody } from "./cloneableBody";
import { contextFromRequest } from "./contextFromRequest";

export function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent
): RequestListener {
  return async function requestListener(req, res) {
    // Get a cloneable body
    const cloneableBody = getCloneableBody(req);

    // Clone the body stream to read the body
    const clonedStream = cloneableBody.cloneBodyStream();
    let body = "";
    for await (const chunk of clonedStream) {
      body += chunk.toString();
    }

    // Finalize to ensure the original request can still be read
    await cloneableBody.finalize();

    callListenerWithContext(listener, req, res, module, agent, body);
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
}
