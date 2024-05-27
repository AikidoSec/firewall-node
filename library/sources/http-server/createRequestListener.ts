import type { IncomingMessage, OutgoingMessage, RequestListener } from "http";
import { PassThrough } from "stream";
import { Agent } from "../../agent/Agent";
import { getContext, runWithContext } from "../../agent/Context";
import { getMaxBodySize } from "../../helpers/getMaxBodySize";
import { replaceRequestBody } from "./replaceRequestBody";
import { contextFromRequest } from "./contextFromRequest";

export function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent
): RequestListener {
  return async function requestListener(req, res) {
    let body = "";
    let bodySize = 0;
    const maxBodySize = getMaxBodySize();
    const stream = new PassThrough();

    try {
      for await (const chunk of req) {
        if (bodySize + chunk.length > maxBodySize) {
          res.statusCode = 413;
          res.write(
            "This request was aborted by Aikido runtime because the body size exceeded the maximum allowed size. Use AIKIDO_MAX_BODY_SIZE_MB to increase the limit."
          );
          res.end();
          agent.getInspectionStatistics().onAbortedRequest();
          return;
        }

        bodySize += chunk.length;
        body += chunk.toString();
        stream.push(chunk);
      }
    } catch {
      res.statusCode = 500;
      res.write(
        "Aikido runtime encountered an error while reading the request body."
      );
      res.end();
      return;
    }

    // End the stream
    stream.push(null);

    // Ensure the body stream can be read again by the application
    replaceRequestBody(req, stream);

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
