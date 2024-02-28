import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";
import { API } from "./API";
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
  ) {
    const request = url.startsWith("https://") ? requestHttps : requestHttp;

    return new Promise<Response | void>((resolve) => {
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
            resolve();
          });
        }
      );

      req.on("error", () => {
        resolve();
      });

      req.write(body);
      req.end();
    });
  }

  async report(token: Token, event: Event) {
    const abort = new AbortController();
    await Promise.race([
      this.fetch(this.reportingUrl.toString(), {
        signal: abort.signal,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.asString(),
        },
        body: JSON.stringify(event),
      }),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          abort.abort();
          resolve();
        }, this.timeoutInMS)
      ),
    ]);
  }
}
