import { LRUMap } from "./LRUMap";

export class RateLimiter {
  private rateLimitedItems: LRUMap<
    string,
    { count: number; startTime: number }
  >;

  constructor(
    readonly maxItems: number,
    readonly timeToLiveInMS: number
  ) {
    this.rateLimitedItems = new LRUMap<
      string,
      { count: number; startTime: number }
    >(maxItems, timeToLiveInMS);
  }

  isAllowed(key: string, windowSizeInMS: number, maxRequests: number): boolean {
    const currentTime = Date.now();
    const requestInfo = this.rateLimitedItems.get(key);

    if (!requestInfo) {
      this.rateLimitedItems.set(key, { count: 1, startTime: currentTime });
      return true;
    }

    const elapsedTime = currentTime - requestInfo.startTime;

    if (elapsedTime > windowSizeInMS) {
      // Reset the counter and timestamp if windowSizeInMS has expired
      this.rateLimitedItems.set(key, { count: 1, startTime: currentTime });
      return true;
    }

    if (requestInfo.count < maxRequests) {
      // Increment the counter if it is within the windowSizeInMS and maxRequests
      requestInfo.count += 1;
      return true;
    }

    // Deny the request if the maxRequests is reached within windowSizeInMS
    return false;
  }
}
