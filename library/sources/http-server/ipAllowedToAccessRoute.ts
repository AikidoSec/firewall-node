import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";

export function ipAllowedToAccessRoute(context: Context, agent: Agent) {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    return true;
  }

  const match = agent.getConfig().getEndpoint(context);

  if (!match) {
    return true;
  }

  const { endpoint } = match;

  if (!Array.isArray(endpoint.allowedIPAddresses)) {
    return true;
  }

  if (endpoint.allowedIPAddresses.length === 0) {
    return true;
  }

  const { allowedIPAddresses } = endpoint;

  if (!context.remoteAddress) {
    return false;
  }

  return allowedIPAddresses.includes(context.remoteAddress);
}
