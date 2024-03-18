import { API, APIResult } from "./API";
import { Token } from "./Token";
import { Event } from "./Event";

type ThrottleOptions = { maxEventsPerInterval: number; intervalInMs: number };

export class APIRateLimitedClientSide implements API {
  private readonly maxEventsPerInterval: number;
  private readonly intervalInMs: number;
  private events: Event[] = [];

  constructor(
    private readonly api: API,
    { maxEventsPerInterval, intervalInMs }: ThrottleOptions
  ) {
    this.maxEventsPerInterval = maxEventsPerInterval;
    this.intervalInMs = intervalInMs;
  }

  async report(token: Token, event: Event): Promise<APIResult> {
    if (event.type === "detected_attack") {
      const currentTime = Date.now();

      // Filter out events that are outside the current interval
      this.events = this.events.filter(
        (e) => e.time > currentTime - this.intervalInMs
      );

      // If we have reached the maximum number of events, we return an error
      // This prevents the array from growing indefinitely
      if (this.events.length >= this.maxEventsPerInterval) {
        return { success: false, error: "max_attacks_reached" };
      }

      this.events.push(event);
    }

    return await this.api.report(token, event);
  }
}
