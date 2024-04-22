import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import type { IncomingMessage } from "node:http";
import { API, APIResult } from "./API";
import { Event } from "./Event";
import { Token } from "./Token";

export class APIFetch implements API {
  constructor(private readonly reportingUrl: URL) {}

  private toAPIResult(response: IncomingMessage, data: string): APIResult {
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
  ): Promise<APIResult> {
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
            resolve(this.toAPIResult(response, data));
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

  async report(
    token: Token,
    event: Event,
    timeoutInMS: number
  ): Promise<APIResult> {
    const abort = new AbortController();

    return await Promise.race([
      this.fetch(this.reportingUrl.toString(), {
        signal: abort.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.asString(),
        },
        body: JSON.stringify(event),
      }),
      new Promise<APIResult>((resolve) =>
        setTimeout(() => {
          abort.abort();
          resolve({ success: false, error: "timeout" });
        }, timeoutInMS)
      ),
    ]);
  }
}
