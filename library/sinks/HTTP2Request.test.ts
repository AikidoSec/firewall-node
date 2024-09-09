import * as t from "tap";
import { connect, IncomingHttpHeaders } from "http2";
import { Agent } from "../agent/Agent";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { HTTP2Request } from "./HTTP2Request";
import { Context, runWithContext } from "../agent/Context";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000",
  query: {},
  headers: {},
  body: {
    image: "http://localhost:4000/api/internal",
  },
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

let _client: ReturnType<typeof connect> | undefined;

function http2Request(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body?: string,
  reuseClient?: boolean
) {
  return new Promise<{ headers: IncomingHttpHeaders; body: string }>(
    (resolve, reject) => {
      if (!reuseClient || !_client) {
        _client = connect(url);
      }
      const req = _client.request({
        ":path": url.pathname + url.search,
        ":method": method,
        "content-length": body ? Buffer.byteLength(body) : 0,
        ...headers,
      });

      let respHeaders: IncomingHttpHeaders;
      let resData = "";

      req.on("error", (err) => {
        reject(err);
      });

      req.on("response", (headers, flags) => {
        respHeaders = headers;
      });

      req.on("data", (chunk) => {
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

t.test("it works", async (t) => {
  const agent = new Agent(
    true,
    new LoggerNoop(),
    new ReportingAPIForTesting(),
    new Token("123"),
    undefined
  );
  agent.start([new HTTP2Request()]);

  t.same(agent.getHostnames().asArray(), []);

  await runWithContext(context, async () => {
    const url = new URL("https://aikido.dev");
    const { headers, body } = await http2Request(url, "GET", {});
    t.same(headers[":status"], 301);

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
  });
});
