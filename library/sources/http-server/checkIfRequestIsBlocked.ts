import type { ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import { getContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { ipAllowedToAccessRoute } from "./ipAllowedToAccessRoute";

/**
 * Inspects the IP address of the request:
 * - Whether the IP address is blocked by an IP blocklist (e.g. Geo restrictions)
 * - Whether the IP address is allowed to access the current route (e.g. Admin panel)
 */
export function checkIfRequestIsBlocked(
  res: ServerResponse,
  agent: Agent
): boolean {
  const context = getContext();

  if (!context) {
    return false;
  }

  const result = context.remoteAddress
    ? agent.getConfig().isIPAddressBlocked(context.remoteAddress)
    : ({ blocked: false } as const);

  if (result.blocked) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");

    let message = `Your IP address is blocked due to ${escapeHTML(result.reason)}.`;
    if (context.remoteAddress) {
      message += ` (Your IP: ${escapeHTML(context.remoteAddress)})`;
    }

    res.end(message);

    return true;
  }

  if (!ipAllowedToAccessRoute(context, agent)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");

    let message = "Your IP address is not allowed to access this resource.";
    if (context.remoteAddress) {
      message += ` (Your IP: ${escapeHTML(context.remoteAddress)})`;
    }

    res.end(message);

    return true;
  }

  const isUserAgentBlocked =
    context.headers && typeof context.headers["user-agent"] === "string"
      ? agent.getConfig().isUserAgentBlocked(context.headers["user-agent"])
      : ({ blocked: false } as const);

  if (isUserAgentBlocked.blocked) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");

    res.end(
      "You are not allowed to access this resource because you have been identified as a bot."
    );

    return true;
  }

  return false;
}
