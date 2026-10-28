import { LRUMap } from "./LRUMap";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding window rate limiter implementation
 */
export class RateLimiter {
  private rateLimitedItems: LRUMap<string, number[]>;

  constructor(
    readonly maxItems: number,
    readonly timeToLiveInMS: number
  ) {
    this.rateLimitedItems = new LRUMap(maxItems, timeToLiveInMS);
  }

  isAllowed(
    key: string,
    windowSizeInMS: number,
    maxRequests: number
  ): RateLimitResult {
    const currentTime = performance.now();
    const requestTimestamps = this.rateLimitedItems.get(key) || [];

    // Filter out timestamps that are older than windowSizeInMS and already expired
    const filteredTimestamps = requestTimestamps.filter(
      (timestamp) => currentTime - timestamp <= windowSizeInMS
    );

    // Ensure the number of entries exceeds maxRequests by only 1
    if (filteredTimestamps.length > maxRequests + 1) {
      filteredTimestamps.splice(
        0,
        filteredTimestamps.length - (maxRequests + 1)
      );
    }

    // Add current request timestamp to the list
    filteredTimestamps.push(currentTime);

    // Update the list of timestamps for the key
    this.rateLimitedItems.set(key, filteredTimestamps);

    if (filteredTimestamps.length <= maxRequests) {
      return { allowed: true };
    }

    // Blocked requests count too, so wait until fewer than maxRequests remain.
    // The window includes its boundary, so round strictly past expiry.
    const blockingTimestamp =
      filteredTimestamps[filteredTimestamps.length - maxRequests] ??
      filteredTimestamps[0];
    const retryAfterMs = Math.max(
      0,
      blockingTimestamp + windowSizeInMS - currentTime
    );

    return {
      allowed: false,
      retryAfterSeconds: Math.floor(retryAfterMs / 1000) + 1,
    };
  }
}
