import { Duplex } from "stream";
import { Agent } from "../../agent/Agent";
import type { IncomingMessage } from "http";
import { contextFromRequest } from "./contextFromRequest";
import { getContext, runWithContext } from "../../agent/Context";
import { shouldRateLimitRequest } from "../../ratelimiting/shouldRateLimitRequest";
import { escapeHTML } from "../../helpers/escapeHTML";

export function createUpgradeListener(
  listener: Function,
  module: string,
  agent: Agent
) {
  return async function upgradeListener(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer
  ) {
    const context = contextFromRequest(req, undefined, `${module}.onUpgrade`);

    return runWithContext(context, () => {
      const context = getContext();

      if (!context) {
        return listener(req, socket, head);
      }

      const result = shouldRateLimitRequest(context, agent);

      if (result.block) {
        let message = "You are rate limited by Aikido firewall.";
        if (result.trigger === "ip") {
          message += ` (Your IP: ${escapeHTML(context.remoteAddress!)})`;
        }

        return socket.end(`HTTP/1.1 429 Too Many Requests\r\n\r\n${message}`);
      }

      return listener(req, socket, head);
    });
  };
}
