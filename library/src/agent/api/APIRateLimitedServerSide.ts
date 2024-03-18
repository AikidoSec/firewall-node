import { API, APIResult } from "./API";
import { Event } from "./Event";
import { Token } from "./Token";

export class APIRateLimitedServerSide implements API {
  private readonly stopSendingForInMilliseconds = 30 * 60 * 1000;
  private rateLimitedAt: number | null = null;

  constructor(private readonly api: API) {}

  async report(token: Token, event: Event): Promise<APIResult> {
    if (
      typeof this.rateLimitedAt === "number" &&
      Date.now() - this.rateLimitedAt < this.stopSendingForInMilliseconds
    ) {
      return { success: false, error: "rate_limited" };
    }

    const result = await this.api.report(token, event);

    if (!result.success && result.error === "rate_limited") {
      this.rateLimitedAt = Date.now();
    }

    return result;
  }
}
