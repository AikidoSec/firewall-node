import { fetch } from "../../helpers/fetch";
import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Event } from "./Event";
import { Token } from "./Token";

export class ReportingAPINodeHTTP implements ReportingAPI {
  constructor(private readonly reportingUrl: URL) {}

  private toAPIResponse(
    statusCode: number,
    data: string
  ): ReportingAPIResponse {
    if (statusCode === 429) {
      return { success: false, error: "rate_limited" };
    }

    if (statusCode === 401) {
      return { success: false, error: "invalid_token" };
    }

    try {
      return JSON.parse(data);
    } catch {
      return { success: false, error: "unknown_error" };
    }
  }

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    let response;
    try {
      response = await fetch({
        url: new URL(`${this.reportingUrl.toString()}api/runtime/events`),
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.asString(),
        },
        body: JSON.stringify(event),
        timeoutInMS,
      });
    } catch (error: any) {
      if (error.message.includes("timed out")) {
        return { success: false, error: "timeout" };
      }

      throw error;
    }

    return this.toAPIResponse(response.statusCode, response.body);
  }
}
