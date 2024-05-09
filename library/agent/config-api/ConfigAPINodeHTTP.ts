import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { Token } from "../api/Token";
import { ConfigAPI, ConfigAPIResponse } from "./ConfigAPI";

export class ConfigAPINodeHTTP implements ConfigAPI {
  constructor(
    private readonly configAPIURL: URL,
    private readonly reportingAPIURL: URL
  ) {}

  private toAPIResponse({
    body,
    statusCode,
  }: {
    body: string;
    statusCode: number;
  }) {
    if (statusCode === 200) {
      const parsedBody = JSON.parse(body);

      if (typeof parsedBody.configUpdatedAt === "number") {
        return parsedBody.configUpdatedAt;
      }
    }

    throw new Error(`Invalid response (${statusCode}): ${body}`);
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
  ): Promise<{ body: string; statusCode: number }> {
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
            resolve(
              this.toAPIResponse({
                body: data,
                statusCode: response.statusCode || 0,
              })
            );
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

  async getLastUpdatedAt(token: Token): Promise<number> {
    const abort = new AbortController();

    return await Promise.race([
      this.fetch(`${this.configAPIURL.toString()}config`, {
        method: "GET",
        signal: abort.signal,
        headers: {
          Authorization: token.asString(),
        },
        body: "",
      }).then((result) => this.toAPIResponse(result)),
      new Promise<number>((resolve, reject) =>
        setTimeout(() => {
          abort.abort();
          reject(new Error("Request timed out"));
        }, 500)
      ),
    ]);
  }

  async getConfig(token: Token): Promise<ConfigAPIResponse> {
    const abort = new AbortController();

    return await Promise.race([
      this.fetch(`${this.reportingAPIURL.toString()}api/runtime/config`, {
        signal: abort.signal,
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.asString(),
        },
        body: "",
      }).then((response) => this.toAPIResponse(response)),
      new Promise<ConfigAPIResponse>((resolve, reject) =>
        setTimeout(() => {
          abort.abort();
          reject(new Error("Request timed out"));
        }, 3000)
      ),
    ]);
  }
}
