import { LRUMap } from "./LRUMap";

export class RateLimiter {
  private requests: LRUMap<string, { count: number; startTime: number }>;

  constructor(
    readonly max: number = 5000,
    readonly ttl: number = 120 * 60 * 1000
  ) {
    this.requests = new LRUMap<string, { count: number; startTime: number }>(
      max,
      ttl
    );
  }

  check(key: string, ttl: number, maxAmount: number): boolean {
    const currentTime = Date.now();
    const requestInfo = this.requests.get(key);

    if (!requestInfo) {
      this.requests.set(key, { count: 1, startTime: currentTime });
      return true;
    }

    const elapsedTime = currentTime - requestInfo.startTime;

    if (elapsedTime > ttl) {
      // Reset the counter and timestamp if TTL has expired
      this.requests.set(key, { count: 1, startTime: currentTime });
      return true;
    }

    if (requestInfo.count < maxAmount) {
      // Increment the counter if it is within the TTL and maxAmount
      requestInfo.count += 1;
      return true;
    }

    // Deny the request if the maxAmount is reached within TTL
    return false;
  }
}
