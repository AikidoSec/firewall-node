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
  const maxBodySize = getMaxBodySize();

  return async function requestListener(req, res) {
    let body = "";
    let bodySize = 0;
    const stream = new PassThrough();

    try {
      for await (const chunk of req) {
        bodySize += chunk.length;

        if (bodySize > maxBodySize) {
          res.statusCode = 413;
          res.write("Request Entity Too Large");
          res.end();
          return;
        }

        body += chunk.toString();
        stream.push(chunk);
      }
    } catch (e) {
      res.statusCode = 500;
      res.write("Internal Server Error");
      res.end();
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
