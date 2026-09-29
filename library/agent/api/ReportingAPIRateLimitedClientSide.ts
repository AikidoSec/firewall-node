import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Token } from "./Token";
import { Event } from "./Event";

type EventGroup = "attacks" | "custom";

type ThrottleOptions = {
  maxEventsPerInterval: number;
  intervalInMs: number;
  eventGroup?: EventGroup;
};

export class ReportingAPIRateLimitedClientSide implements ReportingAPI {
  private readonly maxEventsPerInterval: number;
  private readonly intervalInMs: number;
  private readonly eventGroup: EventGroup;
  private events: number[] = [];
  private oldestEventIndex = 0;

  constructor(
    private readonly api: ReportingAPI,
    {
      maxEventsPerInterval,
      intervalInMs,
      eventGroup = "attacks",
    }: ThrottleOptions
  ) {
    this.maxEventsPerInterval = maxEventsPerInterval;
    this.intervalInMs = intervalInMs;
    this.eventGroup = eventGroup;
  }

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    if (this.isRateLimitedEvent(event) && !this.acceptEvent(Date.now())) {
      return { success: false, error: this.getRateLimitError() };
    }

    return await this.api.report(token, event, timeoutInMS);
  }

  private isRateLimitedEvent(event: Event): boolean {
    switch (this.eventGroup) {
      case "attacks":
        return (
          event.type === "detected_attack" ||
          event.type === "detected_attack_wave"
        );
      case "custom":
        return event.type === "custom";
    }
  }

  private getRateLimitError():
    | "max_attacks_reached"
    | "max_custom_events_reached" {
    switch (this.eventGroup) {
      case "attacks":
        return "max_attacks_reached";
      case "custom":
        return "max_custom_events_reached";
    }
  }

  private acceptEvent(time: number): boolean {
    if (this.events.length < this.maxEventsPerInterval) {
      this.events.push(time);
      return true;
    }

    if (this.events[this.oldestEventIndex] > time - this.intervalInMs) {
      return false;
    }

    this.events[this.oldestEventIndex] = time;
    this.oldestEventIndex =
      (this.oldestEventIndex + 1) % this.maxEventsPerInterval;
    return true;
  }
}
