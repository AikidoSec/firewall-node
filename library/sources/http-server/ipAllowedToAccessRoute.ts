import { Agent } from "../../agent/Agent";
import { Context } from "../../agent/Context";
import { isLocalhostIP } from "../../helpers/isLocalhostIP";

export function ipAllowedToAccessRoute(context: Context, agent: Agent) {
  if (context.remoteAddress && isLocalhostIP(context.remoteAddress)) {
    return true;
  }

  const matches = agent.getConfig().getEndpoints(context);

  for (const endpoint of matches) {
    if (!endpoint.allowedIPAddresses) {
      continue;
    }

    if (!context.remoteAddress) {
      return false;
    }

    const { allowedIPAddresses } = endpoint;

    if (!allowedIPAddresses.has(context.remoteAddress)) {
      return false;
    }
  }

  return true;
}
