import { LRUMap } from "../../ratelimiting/LRUMap";
import type { Context } from "../../agent/Context";
import { isWebScanner } from "./isWebScanner";

export class AttackWaveDetector {
  private suspiciousRequestsMap: LRUMap<string, number>;
  private sentEventsMap: LRUMap<string, number>;

  constructor(
    // How many suspicious requests are allowed before triggering an alert
    private readonly attackWaveThreshold = 6,
    // In what time frame must these requests occur
    private readonly attackWaveTimeFrame = 60 * 1000, // 60 seconds
    // Minimum time before reporting a new event for the same ip
    private readonly minTimeBetweenEvents = 60 * 60 * 1000, // 1 hour
    // Maximum number of entries in the LRU cache
    private readonly maxLRUEntries = 10_000
  ) {
    this.suspiciousRequestsMap = new LRUMap(
      this.maxLRUEntries,
      this.attackWaveTimeFrame
    );
    this.sentEventsMap = new LRUMap(
      this.maxLRUEntries,
      this.minTimeBetweenEvents
    );
  }

  /**
   * Checks if the request is part of an attack wave
   * Will report to core once in a defined time frame when the threshold is exceeded
   * @returns true if an attack wave is detected and should be reported
   */
  check(context: Context): boolean {
    if (!context.remoteAddress) {
      return false;
    }

    const ip = context.remoteAddress;

    const sentEventTime = this.sentEventsMap.get(ip);

    if (sentEventTime) {
      // The last event was sent recently
      return false;
    }

    if (!isWebScanner(context)) {
      return false;
    }

    const suspiciousRequests = (this.suspiciousRequestsMap.get(ip) || 0) + 1;
    this.suspiciousRequestsMap.set(ip, suspiciousRequests);

    if (suspiciousRequests < this.attackWaveThreshold) {
      return false;
    }

    this.sentEventsMap.set(ip, performance.now());

    return true;
  }
}
