import { LRUMap } from "../../ratelimiting/LRUMap";
import type { Context } from "../../agent/Context";
import { isWebScanner } from "./isWebScanner";

export class AttackWaveDetector {
  private suspiciousRequestsMap: LRUMap<string, number>;
  private sentEventsMap: LRUMap<string, number>;

  // How many suspicious requests are allowed before triggering an alert
  private readonly attackWaveThreshold: number;
  // In what time frame must these requests occur
  private readonly attackWaveTimeFrame: number;
  // Minimum time before reporting a new event for the same ip
  private readonly minTimeBetweenEvents: number;
  // Maximum number of entries in the LRU cache
  private readonly maxLRUEntries: number;

  constructor(
    options: {
      attackWaveThreshold?: number;
      attackWaveTimeFrame?: number;
      minTimeBetweenEvents?: number;
      maxLRUEntries?: number;
    } = {}
  ) {
    this.attackWaveThreshold = options.attackWaveThreshold ?? 15; // Default: 15 requests
    this.attackWaveTimeFrame = options.attackWaveTimeFrame ?? 60 * 1000; // Default: 1 minute
    this.minTimeBetweenEvents = options.minTimeBetweenEvents ?? 20 * 60 * 1000; // Default: 20 minutes
    this.maxLRUEntries = options.maxLRUEntries ?? 10_000; // Default: 10,000 entries

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
