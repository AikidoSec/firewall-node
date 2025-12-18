import { LRUMap } from "../../ratelimiting/LRUMap";
import type { Context } from "../../agent/Context";
import { isWebScanner } from "./isWebScanner";

export type SuspiciousRequest = {
  method: string;
  url: string;
};

export class AttackWaveDetector {
  private suspiciousRequests: LRUMap<
    string,
    {
      count: number;
      samples: SuspiciousRequest[];
    }
  >;
  private sentEventsMap: LRUMap<string, number>;

  // How many suspicious requests are allowed before triggering an alert
  private readonly attackWaveThreshold: number;
  // In what time frame must these requests occur
  private readonly attackWaveTimeFrame: number;
  // Minimum time before reporting a new event for the same ip
  private readonly minTimeBetweenEvents: number;
  // Maximum number of entries in the LRU cache
  private readonly maxLRUEntries: number;
  // Maximum number of samples to keep per IP, can not be higher than attackWaveThreshold
  private readonly maxSamplesPerIP: number;

  constructor(
    options: {
      attackWaveThreshold?: number;
      attackWaveTimeFrame?: number;
      minTimeBetweenEvents?: number;
      maxLRUEntries?: number;
      maxSamplesPerIP?: number;
    } = {}
  ) {
    this.attackWaveThreshold = options.attackWaveThreshold ?? 15; // Default: 15 requests
    this.attackWaveTimeFrame = options.attackWaveTimeFrame ?? 60 * 1000; // Default: 1 minute
    this.minTimeBetweenEvents = options.minTimeBetweenEvents ?? 20 * 60 * 1000; // Default: 20 minutes
    this.maxLRUEntries = options.maxLRUEntries ?? 10_000; // Default: 10,000 entries
    this.maxSamplesPerIP = options.maxSamplesPerIP ?? 15; // Default: 15 samples

    this.suspiciousRequests = new LRUMap(
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

    // In isWebScanner we use `context.route`, `context.route` is always created from `context.url`
    if (!context.method || !context.url) {
      return false;
    }

    if (!isWebScanner(context)) {
      return false;
    }

    const suspiciousRequests = this.suspiciousRequests.get(ip) || {
      count: 0,
      samples: [],
    };

    suspiciousRequests.count += 1;

    this.trackSample(
      {
        method: context.method,
        url: context.url,
      },
      suspiciousRequests.samples
    );

    this.suspiciousRequests.set(ip, suspiciousRequests);

    if (suspiciousRequests.count < this.attackWaveThreshold) {
      return false;
    }

    this.sentEventsMap.set(ip, performance.now());

    return true;
  }

  getSamplesForIP(ip: string): SuspiciousRequest[] {
    return this.suspiciousRequests.get(ip)?.samples || [];
  }

  trackSample(request: SuspiciousRequest, samples: SuspiciousRequest[] = []) {
    if (samples.length >= this.maxSamplesPerIP) {
      return;
    }

    // Only store unique samples
    // We can't use a Set because we have objects
    if (
      samples.some(
        (sample) =>
          sample.method === request.method && sample.url === request.url
      )
    ) {
      return;
    }
    samples.push(request);
  }
}
