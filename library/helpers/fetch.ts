import { request as requestHttp, type Agent } from "http";
import { request as requestHttps } from "https";
import { type Readable } from "stream";
import { createGunzip } from "zlib";
import { getInstance } from "../agent/AgentSingleton";
import { getPortFromURL } from "./getPortFromURL";

function request({
  url,
  method,
  body,
  headers,
  signal,
  agent,
}: {
  url: URL;
  method: string;
  headers: Record<string, string>;
  signal: AbortSignal;
  body: string;
  agent?: Agent;
}): Promise<{ body: string; statusCode: number }> {
  const request = url.protocol === "https:" ? requestHttps : requestHttp;

  trackRequest(url);

  return new Promise((resolve, reject) => {
    // Convert URL object to string for compatibility with old https-proxy-agent versions
    // Old agent-base library (used by https-proxy-agent) only works with string URLs
    // and fails when passed URL objects, causing communication with our dashboard to fail
    const req = request(
      url.toString(),
      {
        method,
        headers,
        signal,
        agent,
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
  agent,
}: {
  url: URL;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutInMS?: number;
  agent?: Agent;
}): Promise<{ body: string; statusCode: number }> {
  const abort = new AbortController();

  return await Promise.race([
    request({
      url,
      method,
      headers,
      signal: abort.signal,
      body,
      agent,
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

// Add our own requests as outbound connections (Heartbeats, realtime polling, etc.)
// Only for new instrumentation (see below)
function trackRequest(url: URL) {
  const agent = getInstance();
  if (!agent) {
    // This should not happen
    return;
  }

  // If the old (non ESM) hook system is used, the fetch function used
  // here is already a patched version that tracks requests.
  // If the new hook system is used, the import is executed before
  // the hooks are applied, so we need to track the request here.
  if (!agent.isUsingNewInstrumentation()) {
    return;
  }

  const port = getPortFromURL(url);
  if (!port) {
    return;
  }

  agent.onConnectHostname(url.hostname, port);
}
