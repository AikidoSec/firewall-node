import { IncomingHttpHeaders } from "http2";

let _client: any;

/**
 * HTTP2 Client, use only for testing
 */
export function http2Request(
  url: URL | string,
  method: string,
  headers: Record<string, string>,
  connectOptions?: Record<string, unknown>,
  reuseClient?: boolean,
  body?: string
) {
  const { connect } = require("http2");
  return new Promise<{ headers: IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      if (!reuseClient || !_client) {
        if (connectOptions) {
          _client = connect(url, connectOptions);
        } else {
          _client = connect(url);
        }
      }
      if (typeof url === "string") {
        url = new URL(url);
      }
      _client.on("error", (err: Error) => {
        reject(err);
      });

      const path = url.pathname + (url.search ? url.search : "");

      const req = _client.request({
        ":path": path || "/",
        ":method": method,
        "content-length": body ? Buffer.byteLength(body) : 0,
        ...headers,
      });

      let respHeaders: IncomingHttpHeaders;
      let resData = "";

      req.on("error", (err: Error) => {
        reject(err);
      });

      req.on("response", (headers: Record<string, string>) => {
        respHeaders = headers;
      });

      req.on("data", (chunk: any) => {
        resData += chunk;
      });

      req.on("end", () => {
        _client!.close();
        resolve({ headers: respHeaders, body: resData });
      });
      if (body) {
        return req.end(body);
      }
      req.end();
    }
  );
}
