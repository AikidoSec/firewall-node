/* eslint-disable max-lines-per-function */
import type { ServerResponse } from "http";
import { Agent } from "../../agent/Agent";
import { getContext } from "../../agent/Context";
import { escapeHTML } from "../../helpers/escapeHTML";
import { ipAllowedToAccessRoute } from "./ipAllowedToAccessRoute";

const checkedBlocks = Symbol("__zen_checked_blocks__");

/**
 * Inspects the IP address and user agent of the request:
 * - Whether the IP address is blocked by an IP blocklist (e.g. Geo restrictions)
 * - Whether the IP address is allowed to access the current route (e.g. Admin panel)
 * - Whether the user agent is blocked by a user agent blocklist
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
  res[checkedBlocks] = true;

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

  const result = context.remoteAddress
    ? agent.getConfig().isIPAddressBlocked(context.remoteAddress)
    : ({ blocked: false } as const);

  if (context.remoteAddress) {
    const result = agent.getConfig().isIPAddressBlocked(context.remoteAddress);
    const isMonitoredIP = agent
      .getConfig()
      .isMonitoredIPAddress(context.remoteAddress);

    if (result.blocked || isMonitoredIP) {
      // Find all the matching IP list keys when the IP is part of a blocklist or monitored list
      const matchingIPListKeys = agent
        .getConfig()
        .getMatchingIPListKeys(context.remoteAddress);
      agent.getInspectionStatistics().onIPAddressMatches(matchingIPListKeys);
    }
  }

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

  const isUserAgentBlocked =
    context.headers && typeof context.headers["user-agent"] === "string"
      ? agent.getConfig().isUserAgentBlocked(context.headers["user-agent"])
      : ({ blocked: false } as const);

  const userAgent =
    context.headers && typeof context.headers["user-agent"] === "string"
      ? context.headers["user-agent"]
      : undefined;

  if (userAgent) {
    const isUserAgentBlocked = agent.getConfig().isUserAgentBlocked(userAgent);
    const isMonitoredUserAgent = agent
      .getConfig()
      .isMonitoredUserAgent(userAgent);

    if (isUserAgentBlocked || isMonitoredUserAgent) {
      // Find all the matching user agent keys when it's a blocked or monitored user agent
      const userAgentKeys = agent
        .getConfig()
        .getMatchingUserAgentKeys(userAgent);
      agent.getInspectionStatistics().onUserAgentMatches(userAgentKeys);
    }
  }

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
