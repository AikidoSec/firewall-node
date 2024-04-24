import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Event } from "./Event";
import { Token } from "./Token";

export class ReportingAPIRateLimitedServerSide implements ReportingAPI {
  private readonly stopSendingForInMilliseconds = 30 * 60 * 1000;
  private rateLimitedAt: number | null = null;

  constructor(private readonly api: ReportingAPI) {}

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    if (
      typeof this.rateLimitedAt === "number" &&
      Date.now() - this.rateLimitedAt < this.stopSendingForInMilliseconds
    ) {
      return { success: false, error: "rate_limited" };
    }

    const result = await this.api.report(token, event, timeoutInMS);

    if (!result.success && result.error === "rate_limited") {
      this.rateLimitedAt = Date.now();
    }

    return result;
  }
}
