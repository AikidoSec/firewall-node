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
   * If yes, it will increase the count of suspicious requests
   */
  check(context: Context): void {
    if (!context.remoteAddress) {
      return;
    }

    if (this.sentEventsMap.get(context.remoteAddress)) {
      // The last event was sent recently
      return;
    }

    if (!isWebScanner(context)) {
      return;
    }

    this.increaseSuspiciousCount(context.remoteAddress);
  }

  /**
   * Checks if a new detected attack wave should be reported
   * @returns True if a event should be sent to core, false otherwise
   */
  shouldReport(ip: string): boolean {
    const sentEventTime = this.sentEventsMap.get(ip);
    if (sentEventTime) {
      // The last event was sent recently
      return false;
    }

    const suspiciousRequests = this.getSuspiciousCount(ip);
    if (suspiciousRequests < this.attackWaveThreshold) {
      return false;
    }

    this.sentEventsMap.set(ip, performance.now());

    return true;
  }

  increaseSuspiciousCount(ip: string) {
    const suspiciousRequests = (this.suspiciousRequestsMap.get(ip) || 0) + 1;
    this.suspiciousRequestsMap.set(ip, suspiciousRequests);
  }

  getSuspiciousCount(ip: string) {
    return this.suspiciousRequestsMap.get(ip) || 0;
  }
}
