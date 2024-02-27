import { API } from "./API";
import { Token } from "./Token";
import { Event } from "./Event";

type ThrottleOptions = { maxEventsPerInterval: number; intervalInMs: number };

export class APIThrottled implements API {
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

  async report(token: Token, event: Event) {
    if (event.type === "detected_attack") {
      const currentTime = Date.now();

      this.events = this.events.filter(
        (e) => e.time > currentTime - this.intervalInMs
      );

      if (this.events.length >= this.maxEventsPerInterval) {
        return;
      }

      this.events.push(event);
    }

    await this.api.report(token, event);
  }
}
