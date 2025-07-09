import type { Agent } from "../../agent/Agent";
import type { Context } from "../../agent/Context";
import { isPrivateIP } from "../ssrf/isPrivateIP";
import { verifyBotAuthenticity } from "./verifyBotAuthenticity";

/**
 * Checks if the request is from a bot that is spoofing its user agent. Only supported bots can be checked.
 * If the user agent matches a know bot to verify, either the IP address is checked against a list of known IP addresses or a reverse DNS lookup is performed to verify the authenticity of the bot.
 * The reverse DNS lookup is blocking the request (it's still async, but the checked request is blocked until the DNS lookup is finished).
 */
export async function checkContextForBotSpoofing(
  context: Context,
  agent: Agent
): Promise<
  { isSpoofing: false; key?: string } | { isSpoofing: true; key: string }
> {
  const botSpoofingData = agent.getConfig().getBotSpoofingData();

  if (!botSpoofingData || botSpoofingData.length === 0) {
    return { isSpoofing: false };
  }

  const userAgent = context.headers["user-agent"];
  if (typeof userAgent !== "string" || userAgent.length === 0) {
    return { isSpoofing: false };
  }

  const ip = context.remoteAddress;
  if (!ip || isPrivateIP(ip)) {
    return { isSpoofing: false };
  }

  // Check if the user agent matches any of the bot spoofing patterns
  const matchingBot = botSpoofingData.find((data) =>
    data.uaPattern.test(userAgent)
  );

  if (!matchingBot) {
    // The request is not from a protected bot
    return { isSpoofing: false };
  }

  const isAuthentic = await verifyBotAuthenticity(ip, matchingBot);

  return {
    isSpoofing: !isAuthentic,
    key: matchingBot.key,
  };
}
