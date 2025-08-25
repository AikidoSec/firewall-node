import { LRUMap } from "../../ratelimiting/LRUMap";
import type { Context } from "../../agent/Context";
import { isWebScanner } from "./isWebScanner";

export class AttackWaveDetector {
  // How many suspicious requests are allowed before triggering an alert
  private static readonly ATTACK_WAVE_THRESHOLD = 6;
  // In what time frame must these requests occur
  private static readonly ATTACK_WAVE_TIME_FRAME = 60 * 1000; // 60 seconds
  // Minimum time before reporting a new event for the same ip
  private static readonly MIN_TIME_BETWEEN_EVENTS = 60 * 60 * 1000; // 1 hour
  // Maximum number of entries in the LRU cache
  private static readonly MAX_LRU_ENTRIES = 10_000;

  private suspiciousRequestsMap: LRUMap<string, number>;
  private sentEventsMap: LRUMap<string, number>;

  constructor() {
    this.suspiciousRequestsMap = new LRUMap(
      AttackWaveDetector.MAX_LRU_ENTRIES,
      AttackWaveDetector.ATTACK_WAVE_TIME_FRAME
    );
    this.sentEventsMap = new LRUMap(
      AttackWaveDetector.MAX_LRU_ENTRIES,
      AttackWaveDetector.MIN_TIME_BETWEEN_EVENTS
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

    if (suspiciousRequests < AttackWaveDetector.ATTACK_WAVE_THRESHOLD) {
      return false;
    }

    this.sentEventsMap.set(ip, performance.now());

    return true;
  }
}
