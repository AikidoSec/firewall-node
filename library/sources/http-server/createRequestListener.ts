import type { IncomingMessage, RequestListener, ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import { bindContext, getContext, runWithContext } from "../../agent/Context";
import { isPackageInstalled } from "../../helpers/isPackageInstalled";
import { checkIfRequestIsBlocked } from "./checkIfRequestIsBlocked";
import { contextFromRequest } from "./contextFromRequest";
import { readBodyStream } from "./readBodyStream";
import { shouldDiscoverRoute } from "./shouldDiscoverRoute";

export function createRequestListener(
  listener: Function,
  module: string,
  agent: Agent
): RequestListener {
  const isMicroInstalled = isPackageInstalled("micro");

  return async function requestListener(req, res) {
    // Parse body only if next or micro is installed
    // We can only read the body stream once
    // This is tricky, see replaceRequestBody(...)
    // e.g. Hono uses web requests and web streams
    // (uses Readable.toWeb(req) to convert to a web stream)
    const readBody = "NEXT_DEPLOYMENT_ID" in process.env || isMicroInstalled;

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
  res: ServerResponse,
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
      bindContext(createOnFinishRequestHandler(req, res, agent))
    );

    if (checkIfRequestIsBlocked(res, agent)) {
      // The return is necessary to prevent the listener from being called
      return;
    }

    return listener(req, res);
  });
}

// Use symbol to avoid conflicts with other properties
const countedRequest = Symbol("__zen_request_counted__");

function createOnFinishRequestHandler(
  req: IncomingMessage & { [countedRequest]?: boolean },
  res: ServerResponse,
  agent: Agent
) {
  return function onFinishRequest() {
    if (req[countedRequest]) {
      // The request has already been counted
      // This might happen if the server has multiple listeners
      return;
    }

    // Mark the request as counted
    req[countedRequest] = true;

    const context = getContext();

    if (context && context.route && context.method) {
      const shouldDiscover = shouldDiscoverRoute({
        statusCode: res.statusCode,
        route: context.route,
        method: context.method,
      });

      if (shouldDiscover) {
        agent.onRouteExecute(context);
      }

      if (shouldDiscover || context.rateLimitedEndpoint) {
        agent.getInspectionStatistics().onRequest();
      }

      if (context.rateLimitedEndpoint) {
        agent.getInspectionStatistics().onRateLimitedRequest();
        agent.onRouteRateLimited(context.rateLimitedEndpoint);
      }

      // Ignore successful status codes except redirects
      // as some sites may redirect non existing pages to a different location
      if (
        res.statusCode > 299 &&
        agent.getAttackWaveDetector().check(context)
      ) {
        agent.onDetectedAttackWave({ request: context, metadata: {} });
      }
    }
  };
}
