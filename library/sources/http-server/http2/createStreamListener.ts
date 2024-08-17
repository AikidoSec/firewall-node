import { Agent } from "../../../agent/Agent";
import {
  bindContext,
  Context,
  getContext,
  runWithContext,
} from "../../../agent/Context";
import { escapeHTML } from "../../../helpers/escapeHTML";
import { shouldRateLimitRequest } from "../../../ratelimiting/shouldRateLimitRequest";
import { contextFromStream } from "./contextFromStream";
import { shouldDiscoverRoute } from "../shouldDiscoverRoute";
import { IncomingHttpHeaders, ServerHttp2Stream } from "http2";

/**
 * Wraps the http2 stream listener to get the request context of http2 requests.
 * Also implements route discovery and rate limiting.
 */
export function createStreamListener(
  listener: Function,
  module: string,
  agent: Agent
) {
  return async function requestListener(
    stream: ServerHttp2Stream,
    headers: IncomingHttpHeaders,
    flags: number,
    rawHeaders: string[]
  ) {
    const context = contextFromStream(stream, headers, module);

    return runWithContext(context, () => {
      stream.on(
        "close",
        bindContext(() => {
          const context = getContext();

          discoverRouteFromStream(context, stream, agent);

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

        stream.respond({
          "content-type": "text/plain",
          ":status": 429,
        });

        return stream.end(message);
      }

      // Wrap all stream events to prevent context loss
      stream.on = wrapStreamEvent(stream.on);
      stream.once = wrapStreamEvent(stream.once);
      stream.addListener = wrapStreamEvent(stream.addListener);
      stream.prependListener = wrapStreamEvent(stream.prependListener);
      stream.prependOnceListener = wrapStreamEvent(stream.prependOnceListener);

      return listener(stream, headers, flags, rawHeaders);
    });
  };
}

function discoverRouteFromStream(
  context: Readonly<Context> | undefined,
  stream: ServerHttp2Stream,
  agent: Agent
) {
  if (context && context.route && context.method) {
    const statusCode = parseInt(stream.sentHeaders[":status"] as string);

    if (
      !isNaN(statusCode) &&
      shouldDiscoverRoute({
        statusCode: statusCode,
        route: context.route,
        method: context.method,
      })
    ) {
      agent.onRouteExecute(context.method, context.route);
    }
  }
}

/**
 * This function wraps stream events to ensure that the event handler is always run in the context of the request.
 */
function wrapStreamEvent(orig: Function) {
  return function wrap() {
    // eslint-disable-next-line prefer-rest-params
    const args = Array.from(arguments);
    if (args.length < 2 || typeof args[1] !== "function") {
      return orig.apply(
        // @ts-expect-error We don't know the type of `this`
        this,
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    }
    args[1] = bindContext(args[1]);
    return orig.apply(
      // @ts-expect-error We don't know the type of `this`
      this,
      args
    );
  };
}