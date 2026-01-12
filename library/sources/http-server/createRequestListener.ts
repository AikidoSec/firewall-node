import type { IncomingMessage, RequestListener, ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import {
  type Context,
  getContext,
  runWithContext,
  updateContext,
} from "../../agent/Context";
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

// Use symbol to avoid conflicts with other properties
const countedRequest = Symbol("__zen_request_counted__");

function callListenerWithContext(
  listener: Function,
  req: IncomingMessage & { [countedRequest]?: boolean },
  res: ServerResponse,
  module: string,
  agent: Agent,
  body: unknown
) {
  const context = contextFromRequest(req, body, module);

  return runWithContext(context, () => {
    const context = getContext();

    if (context) {
      res.on("finish", () => {
        // Don't use `getContext()` in this callback
        // The context won't be available when using http2
        // We want the latest context (`runWithContext` updates context if there is already one)
        // Since context is an object, the reference will point to the latest one
        onFinishRequestHandler(req, res, agent, context);
      });
    }

    if (checkIfRequestIsBlocked(res, agent)) {
      if (context) {
        // To prevent attack wave detection from checking this request
        updateContext(context, "blockedDueToIPOrBot", true);
      }

      // The return is necessary to prevent the listener from being called
      return;
    }

    return listener(req, res);
  });
}

function onFinishRequestHandler(
  req: IncomingMessage & { [countedRequest]?: boolean },
  res: ServerResponse,
  agent: Agent,
  context: Context
) {
  if (req[countedRequest]) {
    // The request has already been counted
    // This might happen if the server has multiple listeners
    return;
  }

  // Mark the request as counted
  req[countedRequest] = true;

  if (context.route && context.method) {
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

    if (
      context.remoteAddress &&
      !context.blockedDueToIPOrBot &&
      !agent.getConfig().isBypassedIP(context.remoteAddress) &&
      agent.getAttackWaveDetector().check(context)
    ) {
      agent.onDetectedAttackWave({
        request: context,
      });
      agent.getInspectionStatistics().onAttackWaveDetected();
    }
  }
}
