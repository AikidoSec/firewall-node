import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { API, APIResult } from "./API";
import { Token } from "./Token";
import { Event } from "./Event";

export class APIFetch implements API {
  constructor(
    private readonly reportingUrl: URL,
    private readonly timeoutInMS: number = 5000
  ) {}

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
        (res) => {
          res.on("data", () => {});
          res.on("end", () => {
            if (res.statusCode === 429) {
              resolve({
                success: false,
                error: "rate_limited",
              });
            } else {
              resolve({ success: true });
            }
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

  async report(token: Token, event: Event): Promise<APIResult> {
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
        }, this.timeoutInMS)
      ),
    ]);
  }
}
