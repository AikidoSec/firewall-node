import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Token } from "./Token";
import { Event } from "./Event";

export class ReportingAPIThatThrows implements ReportingAPI {
  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    throw new Error("Failed to report event");
  }

  async getConfig(
    token: Token,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    throw new Error("Failed to get config");
  }
}
