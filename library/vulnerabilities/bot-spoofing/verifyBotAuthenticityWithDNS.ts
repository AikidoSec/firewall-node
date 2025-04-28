import { resolve, reverse } from "dns/promises";
import type { ServiceConfigBotSpoofingData } from "../../agent/ServiceConfig";
import { getInstance } from "../../agent/AgentSingleton";

/**
 * Checks the authenticity of a bot by performing a reverse DNS lookup on the request IP address.
 * Returns true if the bot is authentic, false otherwise.
 *
 * Example:
 *
 * 1. Do a reverse DNS lookup of the request ip
 *   e.g. `54.236.1.12` → crawl-54-236-1-12.pinterest.com
 * 2. Check if the domain matches the expected origin
 *   e.g. Domain is pinterest.com or pinterestcrawler.com for `Pinterestbot`
 * 3. Because PTR records can be spoofed, also lookup the A and AAAA record and compare them with the request ip:
 *   e.g. `crawl-54-236-1-12.pinterest.com` → `54.236.1.12`
 */
export async function verifyBotAuthenticityWithDNS(
  requestIp: string,
  matchingBot: ServiceConfigBotSpoofingData
) {
  try {
    // Send a reverse DNS lookup request
    const hostnames = await reverse(requestIp);
    if (!Array.isArray(hostnames)) {
      // No PTR record found
      return false;
    }

    // Filter out hostnames that don't end with any of the whitelisted hostnames
    const matchingHostnames = hostnames.filter((hostname) =>
      matchingBot.hostnames.some((whitelistedHostname) =>
        // Check if the hostname ends with the whitelisted hostname
        hostname.endsWith(`.${whitelistedHostname}`)
      )
    );

    if (matchingHostnames.length === 0) {
      // No matching hostnames found, so the bot is not authentic
      return false;
    }

    const rrType = requestIp.includes(":") ? "AAAA" : "A";

    // Check if the IP address matches any of the A or AAAA records for the matching hostnames
    for (const hostname of matchingHostnames) {
      const addresses = await resolve(hostname, rrType);
      if (!Array.isArray(addresses)) {
        // No A or AAAA records found
        continue;
      }
      if (addresses.some((address) => address === requestIp)) {
        // The IP address matches the A or AAAA record for the hostname
        return true;
      }
    }

    return false;
  } catch (error) {
    getInstance()?.log(`Bot Spoofing Protection: DNS check failed: ${error}`);
    return true; // Fallback to true on error to prevent blocking legitimate requests
  }
}
