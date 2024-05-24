import type { IncomingMessage, OutgoingMessage, RequestListener } from "http";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { contextFromRequest } from "./contextFromRequest";
import { hasBody } from "./hasBody";
import { replayStream } from "./replayStream";

export function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent
): RequestListener {
  return function requestListener(req, res) {
    if (!hasBody(req)) {
      return callListenerWithContext(
        req,
        res,
        listener,
        undefined,
        agent,
        module
      );
    }

    function onData(chunk: Uint8Array) {
      chunks.push(chunk);
    }

    function onEnd() {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      const body = Buffer.concat(chunks).toString();
      callListenerWithContext(req, res, listener, body, agent, module);
      replayStream(req, chunks);
    }

    const chunks: Uint8Array[] = [];
    req.on("data", onData);
    req.on("end", onEnd);
  };
}

function callListenerWithContext(
  req: IncomingMessage,
  res: OutgoingMessage,
  listener: Function,
  rawBody: string | undefined,
  agent: Agent,
  module: string
) {
  const context = contextFromRequest(req, rawBody, module);

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
