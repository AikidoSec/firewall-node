import { Stats } from "./api/Event";

export class InspectionStatistics {
  private stats: Stats = {};
  private timings: Record<string, number[]> = {};
  private readonly maxSamples: number;
  private readonly maxAverageInMS: number;

  constructor({
    maxSamples,
    maxAverageInMS,
  }: {
    maxSamples: number;
    maxAverageInMS: number;
  }) {
    this.maxSamples = maxSamples;
    this.maxAverageInMS = maxAverageInMS;
  }

  getStats() {
    return this.stats;
  }

  shouldStopInspectingCalls(module: string) {
    if (!this.timings[module]) {
      return false;
    }

    if (this.timings[module].length < this.maxSamples) {
      return false;
    }

    const average =
      this.timings[module].reduce((a, b) => a + b, 0) /
      this.timings[module].length;

    return average > this.maxAverageInMS;
  }

  cleanupTimings(module: string) {
    delete this.timings[module];
  }

  onInspectedCall({
    module,
    withoutContext,
    detectedAttack,
    duration,
    blocked,
  }: {
    module: string;
    detectedAttack: boolean;
    withoutContext: boolean;
    duration: number;
    blocked: boolean;
  }) {
    if (!this.stats[module]) {
      this.stats[module] = {
        blocked: 0,
        allowed: 0,
        withoutContext: 0,
        total: 0,
      };
    }

    this.stats[module].total += 1;

    if (withoutContext) {
      this.stats[module].withoutContext += 1;
      this.stats[module].allowed += 1;
      return;
    }

    if (!this.timings[module]) {
      this.timings[module] = [];
    }

    if (this.timings[module].length >= this.maxSamples) {
      this.timings[module].shift();
    }

    this.timings[module].push(duration);

    if (detectedAttack) {
      if (blocked) {
        this.stats[module].blocked += 1;
      } else {
        this.stats[module].allowed += 1;
      }
    } else {
      this.stats[module].allowed += 1;
    }
  }
}
