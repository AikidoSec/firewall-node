import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { HttpClient } from "./HttpClient";

export class HttpClientNodeHttp implements HttpClient {
  async request(
    method: string,
    url: URL,
    headers: Record<string, string>,
    body: string,
    signal: AbortSignal
  ): Promise<{ body: string; statusCode: number }> {
    return await this.fetch(url.toString(), { signal, method, headers, body });
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
            /* c8 ignore next */
            resolve({ body: data, statusCode: response.statusCode || 0 });
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
}
