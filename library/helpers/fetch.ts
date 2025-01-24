import { IncomingMessage, request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { type Readable } from "stream";
import { createGunzip } from "zlib";

async function request({
  url,
  method,
  body,
  headers,
  signal,
}: {
  url: URL;
  method: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  body: string;
}): Promise<{ body: string; statusCode: number }> {
  const request = url.protocol === "https:" ? requestHttps : requestHttp;

  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method,
        headers,
        signal,
      },
      (response) => {
        let stream: Readable = response;
        if (response.headers["content-encoding"] === "gzip") {
          const gunzip = createGunzip();
          stream = response.pipe(gunzip);
        }

        let data = "";
        stream.on("data", (chunk) => {
          data += chunk;
        });

        stream.on("end", () => {
          // We don't throw errors unless the request times out, is aborted or fails for low level reasons
          // Error objects are annoying to work with
          // That's why we use `resolve` instead of `reject`
          resolve({
            body: data,
            statusCode: response.statusCode || 0,
          });
        });
      }
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.end(body);
  });
}

export async function fetch({
  url,
  method = "GET",
  headers = {},
  body = "",
  timeoutInMS = 5000,
}: {
  url: URL;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutInMS?: number;
}): Promise<{ body: string; statusCode: number }> {
  const abort = new AbortController();

  return await Promise.race([
    request({
      url,
      method,
      headers,
      signal: abort.signal,
      body,
    }),
    new Promise<{
      body: string;
      statusCode: number;
    }>((_, reject) =>
      setTimeout(() => {
        abort.abort();
        reject(
          new Error(
            `Request to ${url.toString()} timed out after ${timeoutInMS}ms`
          )
        );
      }, timeoutInMS)
    ),
  ]);
}
