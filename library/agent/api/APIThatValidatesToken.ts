import { API, APIResult } from "./API";
import { Event } from "./Event";
import { Token } from "./Token";

export class APIThatValidatesToken implements API {
  private tokenIsInvalid = false;

  constructor(private readonly api: API) {}

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<APIResult> {
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
