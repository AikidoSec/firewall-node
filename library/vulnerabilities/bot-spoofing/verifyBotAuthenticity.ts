import type { ServiceConfigBotSpoofingData } from "../../agent/ServiceConfig";
import { verifyBotAuthenticityWithDNS } from "./verifyBotAuthenticityWithDNS";

export async function verifyBotAuthenticity(
  requestIp: string,
  matchingBot: ServiceConfigBotSpoofingData
) {
  // Check if the IP address matches any of the whitelisted IP addresses
  if (matchingBot.ips) {
    if (matchingBot.ips.has(requestIp)) {
      return true;
    }
  }

  if (matchingBot.hostnames.length > 0) {
    // Check if the hostname matches any of the whitelisted hostnames
    return await verifyBotAuthenticityWithDNS(requestIp, matchingBot);
  }

  return false;
}
