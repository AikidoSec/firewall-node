import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import type { IncomingMessage } from "node:http";
import { isPlainObject } from "../../helpers/isPlainObject";
import { ReportingAPI, ReportingAPIResponse } from "./ReportingAPI";
import { Event } from "./Event";
import { Token } from "./Token";

export class ReportingAPINodeHTTP implements ReportingAPI {
  constructor(private readonly reportingUrl: URL) {}

  private toAPIResponse(
    response: IncomingMessage,
    data: string
  ): ReportingAPIResponse {
    if (response.statusCode === 429) {
      return { success: false, error: "rate_limited" };
    }

    if (response.statusCode === 401) {
      return { success: false, error: "invalid_token" };
    }

    try {
      return JSON.parse(data);
    } catch {
      return { success: false, error: "unknown_error" };
    }
  }

  private async fetch(
    url: string,
    {
      signal,
      method,
      body,
      headers,
    }: {
      signal: AbortSignal;
      method: string;
      headers: Record<string, string>;
      body: string;
    }
  ): Promise<ReportingAPIResponse> {
    /* c8 ignore next */
    const request = url.startsWith("https://") ? requestHttps : requestHttp;

    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          method,
          headers,
          signal,
        },
        (response) => {
          let data = "";
          response.on("data", (chunk) => {
            data += chunk;
          });
          response.on("end", () => {
            // We don't throw errors unless the request times out, is aborted or fails for low level reasons
            // Error objects are annoying to work with
            // That's why we use `resolve` instead of `reject`
            resolve(this.toAPIResponse(response, data));
          });
        }
      );

      req.on("error", (error) => {
        reject(error);
      });

      req.write(body);
      req.end();
    });
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
      this.fetch(url.toString(), {
        signal: abort.signal,
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: token.asString(),
        },
        body: isPlainObject(body) ? JSON.stringify(body) : "",
      }),
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
