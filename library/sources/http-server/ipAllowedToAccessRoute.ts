import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { isLocalhostIP } from "../../helpers/isLocalhostIP";

export function ipAllowedToAccessRoute(context: Context, agent: Agent) {
  if (context.remoteAddress && isLocalhostIP(context.remoteAddress)) {
    return true;
  }

  const matches = agent.getConfig().getEndpoints(context);

  for (const endpoint of matches) {
    if (!Array.isArray(endpoint.allowedIPAddresses)) {
      return true;
    }

    if (endpoint.allowedIPAddresses.length === 0) {
      return true;
    }

    if (!context.remoteAddress) {
      return false;
    }

    const { allowedIPAddresses } = endpoint;

    if (!allowedIPAddresses.includes(context.remoteAddress)) {
      return false;
    }
  }

  return true;
}
