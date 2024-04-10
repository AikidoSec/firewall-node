import { Token } from "./Token";
import { Event } from "./Event";
import { API, APIResult } from "./API";

export class APIForTesting implements API {
  private events: Event[] = [];

  constructor(
    private result: APIResult = { success: true },
    private readonly reportingURL = new URL("https://guard.aikido.dev")
  ) {}

  setResult(result: APIResult) {
    this.result = result;
  }

  getReportingURL(): URL {
    return this.reportingURL;
  }

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<APIResult> {
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
