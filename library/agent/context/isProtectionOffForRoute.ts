import type { Agent } from "../Agent";
import { type Context } from "../Context";

export function isProtectionOffForRoute(
  agent: Agent,
  context: Readonly<Context> | undefined
): boolean {
  if (!context) {
    return false;
  }

  const matches = agent.getConfig().getEndpoints(context);
  const protectionOff = matches.some(
    (match) => match.forceProtectionOff === true
  );

  return protectionOff;
}
