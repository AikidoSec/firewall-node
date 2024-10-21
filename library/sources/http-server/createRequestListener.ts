import type { IncomingMessage, RequestListener, ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import { bindContext, getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { contextFromRequest } from "./contextFromRequest";
import { ipAllowedToAccessRoute } from "./ipAllowedToAccessRoute";
import { readBodyStream } from "./readBodyStream";
import { shouldDiscoverRoute } from "./shouldDiscoverRoute";

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
  res: ServerResponse<IncomingMessage>,
  module: string,
  agent: Agent,
  body: string
) {
  const context = contextFromRequest(req, body, module);

  return runWithContext(context, () => {
    // This method is called when the response is finished and discovers the routes for display in the dashboard
    // The bindContext function is used to ensure that the context is available in the callback
    // If using http2, the context is not available in the callback without this
    res.on("finish", bindContext(createOnFinishRequestHandler(res, agent)));

    if (!ipAllowedToAccessRoute(context, agent)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "text/plain");

      let message = "Your IP address is not allowed to access this resource.";
      if (context.remoteAddress) {
        message += ` (Your IP: ${escapeHTML(context.remoteAddress)})`;
      }

      return res.end(message);
    }

    return listener(req, res);
  });
}

function createOnFinishRequestHandler(
  res: ServerResponse<IncomingMessage>,
  agent: Agent
) {
  return function onFinishRequest() {
    const context = getContext();

    if (
      context &&
      context.route &&
      context.method &&
      shouldDiscoverRoute({
        statusCode: res.statusCode,
        route: context.route,
        method: context.method,
      })
    ) {
      agent.onRouteExecute(context);
    }

    agent.getInspectionStatistics().onRequest();
    if (context && context.attackDetected) {
      agent.getInspectionStatistics().onDetectedAttack({
        blocked: agent.shouldBlock(),
      });
    }
  };
}
