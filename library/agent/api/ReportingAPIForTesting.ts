/* oxlint-disable no-unused-vars */
import { Token } from "./Token";
import { Event } from "./Event";
import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";

export class ReportingAPIForTesting implements ReportingAPI {
  private events: Event[] = [];

  constructor(
    private result: ReportingAPIResponse = {
      success: true,
      endpoints: [],
      configUpdatedAt: 0,
      heartbeatIntervalInMS: 10 * 60 * 1000,
      blockedUserIds: [],
      allowedIPAddresses: [],
    }
  ) {}

  setResult(result: ReportingAPIResponse) {
    this.result = result;
  }

  // oxlint-disable-next-line require-await
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
}
