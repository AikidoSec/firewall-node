/* eslint-disable max-lines-per-function */
import type { ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import { getContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { ipAllowedToAccessRoute } from "./ipAllowedToAccessRoute";

const checkedBlocks = Symbol("__zen_checked_blocks__");

/**
 * Inspects the IP address of the request:
 * - Whether the IP address is blocked by an IP blocklist (e.g. Geo restrictions)
 * - Whether the IP address is allowed to access the current route (e.g. Admin panel)
 */
export function checkIfRequestIsBlocked(
  res: ServerResponse & { [checkedBlocks]?: boolean },
  agent: Agent
): boolean {
  if (res.headersSent) {
    // The headers have already been sent, so we can't block the request
    // This might happen if the server has multiple listeners
    return false;
  }

  const context = getContext();

  if (!context) {
    return false;
  }

  if (res[checkedBlocks]) {
    return false;
  }

  // We don't need to check again if the request has already been checked
  // Also ensures that the statistics are only counted once
  // res[checkedBlocklist] = true;

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

  const isBypassedIP =
    context.remoteAddress &&
    agent.getConfig().isBypassedIP(context.remoteAddress);

  if (isBypassedIP) {
    return false;
  }

  if (
    context.remoteAddress &&
    !agent.getConfig().isAllowedIPAddress(context.remoteAddress).allowed
  ) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");

    let message = "Your IP address is not allowed to access this resource.";
    if (context.remoteAddress) {
      message += ` (Your IP: ${escapeHTML(context.remoteAddress)})`;
    }

    res.end(message);

    return true;
  }

  const blockedIPs = context.remoteAddress
    ? agent.getConfig().getBlockedIPAddresses(context.remoteAddress)
    : [];

  agent.getInspectionStatistics().onIPAddressMatches(blockedIPs);
  const blockingMatch = blockedIPs.find((match) => !match.monitor);

  if (blockingMatch) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");

    let message = `Your IP address is blocked due to ${escapeHTML(blockingMatch.reason)}.`;
    if (context.remoteAddress) {
      message += ` (Your IP: ${escapeHTML(context.remoteAddress)})`;
    }

    res.end(message);
    return true;
  }

  const blockedUserAgents =
    context.headers && typeof context.headers["user-agent"] === "string"
      ? agent.getConfig().getBlockedUserAgents(context.headers["user-agent"])
      : [];

  agent.getInspectionStatistics().onUserAgentMatches(blockedUserAgents);

  if (blockedUserAgents.find((match) => !match.monitor)) {
    res.statusCode = 403;
    res.setHeader("Content-Type", "text/plain");

    res.end(
      "You are not allowed to access this resource because you have been identified as a bot."
    );
    return true;
  }

  return false;
}
