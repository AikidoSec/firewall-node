import { LRUMap } from "./LRUMap";

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

  isAllowed(key: string, windowSizeInMS: number, maxRequests: number): boolean {
    const currentTime = performance.now();
    const requestTimestamps = this.rateLimitedItems.get(key) || [];

    // Filter out timestamps that are older than windowSizeInMS and already expired
    const filteredTimestamps = requestTimestamps.filter(
      (timestamp) => currentTime - timestamp <= windowSizeInMS
    );

    // Add current request timestamp to the list
    filteredTimestamps.push(currentTime);

    // Update the list of timestamps for the key
    this.rateLimitedItems.set(key, filteredTimestamps);

    // Check if the number of requests is less or equal to the maxRequests
    return filteredTimestamps.length <= maxRequests;
  }
}
