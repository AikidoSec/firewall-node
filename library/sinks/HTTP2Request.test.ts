/* eslint-disable prefer-rest-params */
import * as t from "tap";
import type { IncomingHttpHeaders } from "http2";
import { Agent } from "../agent/Agent";
import { LoggerNoop } from "../agent/logger/LoggerNoop";
import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { Token } from "../agent/api/Token";
import { HTTP2Request } from "./HTTP2Request";
import { Context, runWithContext } from "../agent/Context";
import { wrap } from "../helpers/wrap";
import * as dns from "dns";
import { getMajorNodeVersion } from "../helpers/getNodeVersion";

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

const calls: Record<string, number> = {};
wrap(dns, "lookup", function lookup(original) {
  return function lookup() {
    const hostname = arguments[0];

    if (!calls[hostname]) {
      calls[hostname] = 0;
    }

    calls[hostname]++;

    if (
      hostname === "thisdomainpointstointernalip.com" ||
      hostname === "thisdomainpointstointernalip2.com"
    ) {
      return original.apply(this, [
        "localhost",
        ...Array.from(arguments).slice(1),
      ]);
    }

    original.apply(this, arguments);
  };
});

let _client;

function http2Request(
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
      _client.on("error", (err) => {
        reject(err);
      });

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
    const { headers, body } = await http2Request(
      new URL("https://aikido.dev"),
      "GET",
      {}
    );
    t.same(headers[":status"], 301);

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
  });

  await runWithContext(context, async () => {
    agent.getHostnames().clear();

    const { headers } = await http2Request("https://aikido.dev", "GET", {});
    t.same(headers[":status"], 301);

    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
  });

  await runWithContext(context, async () => {
    agent.getHostnames().clear();
    let callbackCalled = false;
    const { headers } = await http2Request(
      // @ts-expect-error Passing a url like object
      {
        hostname: "aikido.dev",
        port: "443",
        pathname: "/",
      },
      "GET",
      {},
      () => {
        callbackCalled = true;
      }
    );
    t.same(headers[":status"], 301);
    t.same(agent.getHostnames().asArray(), [
      { hostname: "aikido.dev", port: 443 },
    ]);
    t.same(callbackCalled, true);
  });

  await runWithContext(context, async () => {
    try {
      await http2Request("https://localhost:4000/api/internal", "GET", {});
      t.fail("should not reach here");
    } catch (e) {
      t.same(
        e.message,
        "Aikido firewall has blocked a server-side request forgery: http2.connect(...) originating from body.image"
      );
    }
  });

  await runWithContext(
    { ...context, ...{ body: { image: "thisdomainpointstointernalip.com" } } },
    async () => {
      try {
        const { headers, body } = await http2Request(
          "https://thisdomainpointstointernalip.com",
          "GET",
          {},
          {}
        );
        if (getMajorNodeVersion() > 16) {
          t.fail("should not reach here");
          return;
        }
        t.same(headers, undefined);
        t.same(body, "");
      } catch (e) {
        t.match(
          e.message,
          /Aikido firewall has blocked a server-side request forgery: http2.connect.* originating from body.image/
        );

        // Ensure the lookup is only called once per hostname
        // Otherwise, it could be vulnerable to TOCTOU
        t.same(calls["thisdomainpointstointernalip.com"], 1);
      }
    }
  );

  await runWithContext(
    { ...context, ...{ body: { image: "thisdomainpointstointernalip2.com" } } },
    async () => {
      try {
        const { headers, body } = await http2Request(
          "https://thisdomainpointstointernalip2.com",
          "GET",
          {},
          {
            lookup: dns.lookup,
          }
        );
        if (getMajorNodeVersion() > 16) {
          t.fail("should not reach here");
          return;
        }
        t.same(headers, undefined);
        t.same(body, "");
      } catch (e) {
        t.match(
          e.message,
          /Aikido firewall has blocked a server-side request forgery: http2.connect.* originating from body.image/
        );

        // Ensure the lookup is only called once per hostname
        // Otherwise, it could be vulnerable to TOCTOU
        t.same(calls["thisdomainpointstointernalip2.com"], 1);
      }
    }
  );
});
