import type { Agent } from "../../agent/Agent";
import type { Context } from "../../agent/Context";
import { isPrivateIP } from "../ssrf/isPrivateIP";
import { verifyBotAuthenticity } from "./verifyBotAuthenticity";

export async function checkContextForBotSpoofing(
  context: Context,
  agent: Agent
) {
  const botSpoofingData = agent.getConfig().getBotSpoofingData();

  if (!botSpoofingData || botSpoofingData.length === 0) {
    return false;
  }

  const userAgent = context.headers["user-agent"];
  const ip = context.remoteAddress;

  if (!ip || isPrivateIP(ip)) {
    return false;
  }

  if (typeof userAgent !== "string" || userAgent.length === 0) {
    return false;
  }

  // Check if the user agent matches any of the bot spoofing patterns
  const matchingBot = botSpoofingData.find((data) =>
    data.uaPattern.test(userAgent)
  );

  if (!matchingBot) {
    // The request is not from a protected bot
    return false;
  }

  return !(await verifyBotAuthenticity(ip, matchingBot));
}
