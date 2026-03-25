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
      blockNewOutgoingRequests: false,
      domains: [],
    }
  ) {}

  setResult(result: ReportingAPIResponse) {
    this.result = result;
  }

  // oxlint-disable-next-line require-await
  async report(
    token: Token,
    event: Event,
    _timeoutInMS: number
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
