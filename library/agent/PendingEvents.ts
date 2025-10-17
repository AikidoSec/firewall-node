import { setTimeout } from "timers/promises";

/**
 * Attack events (detected_attack and detected_attack_wave) are sent as fire-and-forget promises.
 *
 * However, in serverless environments like Lambda and Cloud Functions,
 * if the handler returns quickly, the execution environment freezes before these API calls complete, causing events to be lost.
 *
 * This class tracks these pending promises so they can be awaited before the function returns.
 *
 * Heartbeat and started events are already handled in the Lambda/Cloud Function integration and don't need tracking.
 */
export class PendingEvents {
  private pendingPromises: Set<Promise<unknown>> = new Set();

  onAPICall(apiPromise: Promise<unknown>): void {
    this.pendingPromises.add(apiPromise);

    apiPromise.finally(() => {
      this.pendingPromises.delete(apiPromise);
    });
  }

  async waitUntilSent(timeoutInMS: number): Promise<void> {
    if (this.pendingPromises.size === 0) {
      return;
    }

    const promises = Array.from(this.pendingPromises);

    await Promise.race([Promise.allSettled(promises), setTimeout(timeoutInMS)]);
  }
}
