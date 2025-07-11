import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { isLocalhostIP } from "../../helpers/isLocalhostIP";
import type { Endpoint } from "../../agent/Config";
import type { IPMatcher } from "../../helpers/ip-matcher/IPMatcher";

export function ipAllowedToAccessRoute(context: Context, agent: Agent) {
  // Always allow localhost IPs
  if (context.remoteAddress && isLocalhostIP(context.remoteAddress)) {
    return true;
  }

  // Get all matching endpoints with allowedIPAddresses defined
  const matches = agent
    .getConfig()
    .getEndpoints(context)
    .filter(
      (m): m is Endpoint & { allowedIPAddresses: IPMatcher } =>
        m.allowedIPAddresses !== undefined
    );

  if (!matches.length) {
    // No matches found, so we can allow access
    return true;
  }

  if (!context.remoteAddress) {
    // Always block if remote address is unknown
    return false;
  }

  // Check exact match first
  // If exact match allows the IP address, we can allow access without checking other matching endpoint configurations
  const exact = matches.find((m) => m.route === context.route);
  if (exact && exact.allowedIPAddresses) {
    if (exact.allowedIPAddresses.has(context.remoteAddress)) {
      return true;
    }
  }

  for (const endpoint of matches) {
    const { allowedIPAddresses } = endpoint;

    if (!allowedIPAddresses.has(context.remoteAddress)) {
      return false;
    }
  }

  return true;
}
