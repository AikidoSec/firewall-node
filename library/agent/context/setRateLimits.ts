import { isPlainObject } from "../../helpers/isPlainObject";
import { getInstance } from "../AgentSingleton";

type Route = string;
type Config = {
  maxRequests: number;
  windowSizeInMS: number;
};

export function setRateLimits(rateLimits: Record<Route, Config>): void {
  const agent = getInstance();

  if (!agent) {
    return;
  }

  if (!isPlainObject(rateLimits)) {
    // TODO: Warning
    return;
  }

  agent.getConfig().setCustomRateLimits(
    Object.keys(rateLimits).map((route) => {
      return {
        allowedIPAddresses: undefined,
        rateLimiting: {
          enabled: true,
          windowSizeInMS: rateLimits[route].windowSizeInMS,
          maxRequests: rateLimits[route].maxRequests,
        },
        graphql: undefined,
        method: "*",
        route: route,
        forceProtectionOff: false,
      };
    })
  );

  console.log(agent.getConfig());
}
