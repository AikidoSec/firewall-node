import type { Agent } from "../Agent";
import { updateContext, type Context } from "../Context";

export function isProtectionOffForRoute(
  agent: Agent,
  context: Readonly<Context> | undefined
): boolean {
  if (!context) {
    return false;
  }

  if (typeof context.forceProtectionOff == "boolean") {
    return context.forceProtectionOff;
  }

  const matches = agent.getConfig().getEndpoints(context);
  const protectionOff = matches.some(
    (match) => match.forceProtectionOff === true
  );

  updateContext(context, "forceProtectionOff", protectionOff);

  return protectionOff;
}
