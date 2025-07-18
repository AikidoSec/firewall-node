/* eslint-disable max-lines-per-function */
import { request as requestHttp } from "http";
import { request as requestHttps } from "https";
import { type Readable } from "stream";
import { createGunzip } from "zlib";
import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

async function request({
  url,
  method,
  body,
  headers,
  signal,
  compressBody,
}: {
  url: URL;
  method: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  body: string;
  compressBody: boolean;
}): Promise<{ body: string; statusCode: number }> {
  const request = url.protocol === "https:" ? requestHttps : requestHttp;

  // We need to set the Accept-Encoding header to "gzip" to receive the response in gzip format
  headers["Accept-Encoding"] = "gzip";

  const compressedBody = await handleRequestCompression(
    body,
    headers,
    compressBody
  );

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

    req.end(compressedBody);
  });
}

export async function fetch({
  url,
  method = "GET",
  headers = {},
  body = "",
  timeoutInMS = 5000,
  compressBody = true,
}: {
  url: URL;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutInMS?: number;
  compressBody?: boolean;
}): Promise<{ body: string; statusCode: number }> {
  const abort = new AbortController();

  return await Promise.race([
    request({
      url,
      method,
      headers,
      signal: abort.signal,
      body,
      compressBody,
    }),
    new Promise<{
      body: string;
      statusCode: number;
    }>((_, reject) => {
      const timeout = setTimeout(() => {
        abort.abort();
        reject(
          new Error(
            `Request to ${url.toString()} timed out after ${timeoutInMS}ms`
          )
        );
      }, timeoutInMS);

      // We don't want to keep Node.js running because of this timeout
      timeout.unref();
    }),
  ]);
}

async function handleRequestCompression(
  body: string,
  headers: Record<string, string>,
  compressBody: boolean
): Promise<Buffer | string | undefined> {
  if (!body) {
    // Dont try to compress an empty string
    return;
  }

  if (!compressBody) {
    return body;
  }

  const compressed = await gzipAsync(body);

  // Add required headers for gzip compression
  headers["Content-Encoding"] = "gzip";
  headers["Content-Length"] = compressed.length.toString();

  return compressed;
}
