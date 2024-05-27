import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Event } from "./Event";
import { Token } from "./Token";

export class ReportingAPIThatValidatesToken implements ReportingAPI {
  private tokenIsInvalid = false;

  constructor(private readonly api: ReportingAPI) {}

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    if (this.tokenIsInvalid) {
      return { success: false, error: "invalid_token" };
    }

    const result = await this.api.report(token, event, timeoutInMS);

    if (!result.success && result.error === "invalid_token") {
      this.tokenIsInvalid = true;
    }

    return result;
  }
}
