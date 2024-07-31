import type { IncomingMessage, RequestListener, ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import { bindContext, getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import { contextFromRequest } from "./contextFromRequest";
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
    res.on(
      "finish",
      bindContext(() => {
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
          agent.onRouteExecute(context.method, context.route);
        }

        agent.getInspectionStatistics().onRequest();
        if (context && context.attackDetected) {
          agent.getInspectionStatistics().onDetectedAttack({
            blocked: agent.shouldBlock(),
          });
        }
      })
    );

    const result = shouldRateLimitRequest(context, agent);

    if (result.block) {
      let message = "You are rate limited by Aikido firewall.";
      if (result.trigger === "ip") {
        message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
      }

      res.statusCode = 429;
      res.setHeader("Content-Type", "text/plain");

      return res.end(message);
    }

    return listener(req, res);
  });
}
