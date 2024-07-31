import { Agent } from "../../agent/Agent";
import { bindContext, getContext, runWithContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import { contextFromStream } from "./contextFromStream";
import { shouldDiscoverRoute } from "./shouldDiscoverRoute";
import { IncomingHttpHeaders, ServerHttp2Stream } from "http2";

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

          if (context && context.route && context.method) {
            const statusCode = parseInt(
              stream.sentHeaders[":status"] as string
            );

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

      return listener(stream, headers, flags, rawHeaders);
    });
  };
}
