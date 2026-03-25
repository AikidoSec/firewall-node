import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Token } from "./Token";
import { Event } from "./Event";

export class ReportingAPIThatThrows implements ReportingAPI {
  // oxlint-disable-next-line require-await
  async report(
    _token: Token,
    _event: Event,
    _timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    throw new Error("Failed to report event");
  }
}
