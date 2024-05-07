import { Token } from "../Token";
import { Event } from "./Event";
import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";

export class ReportingAPIForTesting implements ReportingAPI {
  private events: Event[] = [];

  constructor(private result: ReportingAPIResponse = { success: true }) {}

  setResult(result: ReportingAPIResponse) {
    this.result = result;
  }

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    this.events.push(event);

    return this.result;
  }

  clear() {
    this.events = [];
  }

  getEvents() {
    return this.events;
  }

  getConfig(token: Token, timeoutInMS: number): Promise<ReportingAPIResponse> {
    throw new Error("Method not implemented.");
  }
}
