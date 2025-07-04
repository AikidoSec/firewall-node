import { Resolver } from "dns/promises";
import type { ServiceConfigBotSpoofingData } from "../../agent/ServiceConfig";
import { getInstance } from "../../agent/AgentSingleton";
import { LRUMap } from "../../ratelimiting/LRUMap";

// Cache results to avoid repeated DNS lookups for the same IP address and bot combination
const cache = new LRUMap<string, boolean>(1000, 5 * 60 * 1000);

const dnsResolver = new Resolver({
  timeout: 50, // ms
});

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
  // Cache key contains the request IP and the matching bot key
  const cacheKey = `${requestIp}-${matchingBot.key}`;
  // Check if the result is already cached
  const cacheResult = cache.get(cacheKey);
  if (typeof cacheResult === "boolean") {
    return cacheResult;
  }

  try {
    // Send a reverse DNS lookup request
    const hostnames = await dnsResolver.reverse(requestIp);

    // Filter out hostnames that don't end with any of the allowed hostnames
    const matchingHostnames = hostnames.filter((hostname) =>
      matchingBot.hostnames.some((allowedHostname) =>
        // Check if the hostname ends with the allowed hostname
        hostname.endsWith(`.${allowedHostname}`)
      )
    );

    if (matchingHostnames.length === 0) {
      // No matching hostnames found, so the bot is not authentic
      cache.set(cacheKey, false);
      return false;
    }

    const rrType = requestIp.includes(":") ? "AAAA" : "A";

    // Check if the IP address matches any of the A or AAAA records for the matching hostnames
    for (const hostname of matchingHostnames) {
      const addresses = await dnsResolver.resolve(hostname, rrType);
      if (!Array.isArray(addresses)) {
        // No A or AAAA records found
        continue;
      }
      if (addresses.some((address) => address === requestIp)) {
        // The IP address matches the A or AAAA record for the
        cache.set(cacheKey, true);
        return true;
      }
    }

    cache.set(cacheKey, false);
    return false;
  } catch (error) {
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOTFOUND"
    ) {
      // No matching hostnames found, so the bot is not authentic
      cache.set(cacheKey, false);
      return false;
    }

    getInstance()?.log(`Bot Spoofing Protection: DNS check failed: ${error}`);
    return true; // Fallback to true on error to prevent blocking legitimate requests
  }
}
