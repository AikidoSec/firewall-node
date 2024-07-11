import { request as requestHttp } from "node:http";
import { request as requestHttps } from "node:https";

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
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
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

    req.write(body);
    req.end();
  });
}

export async function fetch({
  url,
  method,
  headers,
  body = "",
  timeoutInMS,
}: {
  url: URL;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timeoutInMS: number;
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
