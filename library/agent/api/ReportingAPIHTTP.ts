import { isPlainObject } from "../../helpers/isPlainObject";
import { HttpClient } from "../http/HttpClient";
import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Event } from "./Event";
import { Token } from "../Token";

export class ReportingAPIHTTP implements ReportingAPI {
  constructor(
    private readonly reportingUrl: URL,
    private readonly http: HttpClient
  ) {}

  private toAPIResponse({
    body,
    statusCode,
  }: {
    statusCode: number;
    body: string;
  }): ReportingAPIResponse {
    if (statusCode === 429) {
      return { success: false, error: "rate_limited" };
    }

    if (statusCode === 401) {
      return { success: false, error: "invalid_token" };
    }

    try {
      return JSON.parse(body);
    } catch {
      return { success: false, error: "unknown_error" };
    }
  }

  private async doRequest(
    url: URL,
    token: Token,
    method: "GET" | "POST",
    body: unknown,
    timeoutInMS: number
  ) {
    const abort = new AbortController();

    return await Promise.race([
      this.http
        .request(
          method,
          url,
          {
            "Content-Type": "application/json",
            Authorization: token.asString(),
          },
          isPlainObject(body) ? JSON.stringify(body) : "",
          abort.signal
        )
        .then(({ body, statusCode }) =>
          this.toAPIResponse({ body, statusCode })
        ),
      new Promise<ReportingAPIResponse>((resolve) =>
        setTimeout(() => {
          abort.abort();
          resolve({ success: false, error: "timeout" });
        }, timeoutInMS)
      ),
    ]);
  }

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    return await this.doRequest(
      this.reportingUrl,
      token,
      "POST",
      event,
      timeoutInMS
    );
  }

  async getConfig(
    token: Token,
    timeoutInMS: number
  ): Promise<ReportingAPIResponse> {
    const configURL = new URL(this.reportingUrl);
    configURL.pathname = configURL.pathname.replace("/events", "/config");

    return await this.doRequest(
      configURL,
      token,
      "GET",
      undefined,
      timeoutInMS
    );
  }
}
