import * as t from "tap";
import * as dc from "diagnostics_channel";
import { createSecureServer } from "http2";
import { readFileSync } from "fs";
import { join } from "path";
import type { AddressInfo } from "net";
import { parseHeaders } from "./parseHeaders";
import { getMajorNodeVersion } from "../../helpers/getNodeVersion";

t.test("it works", async (t) => {
  t.same(
    parseHeaders([
      Buffer.from("content-type"),
      Buffer.from("application/json"),
    ]),
    { "content-type": "application/json" }
  );
  t.same(
    parseHeaders([
      Buffer.from("content-type"),
      Buffer.from("application/json"),
      Buffer.from("content-type"),
      Buffer.from("application/xml"),
    ]),
    { "content-type": ["application/json", "application/xml"] }
  );
  t.same(
    parseHeaders([
      "content-type",
      Buffer.from("application/json"),
      "x-foo",
      "a",
    ]),
    { "content-type": "application/json", "x-foo": "a" }
  );

  t.same(
    parseHeaders([
      "content-type",
      Buffer.from("application/json"),
      "content-disposition",
      Buffer.from('attachment; filename="test.txt"'),
    ]),
    {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="test.txt"',
    }
  );

  t.same(parseHeaders([], {}), {});

  t.same(
    parseHeaders([
      "content-length",
      [Buffer.from("123"), Buffer.from("456")],
      "content-disposition",
      Buffer.from('attachment; filename="test.txt"'),
    ]),
    {
      "content-length": ["123", "456"],
      "content-disposition": 'attachment; filename="test.txt"',
    }
  );
});

t.test(
  "it parses the response headers of HTTP/2 requests",
  {
    skip:
      getMajorNodeVersion() < 22
        ? "undici v8 requires Node.js 22+ (ReadableStream)"
        : false,
  },
  async (t) => {
    const { Agent, fetch } = require("undici-v8") as typeof import("undici-v8");

    const server = createSecureServer(
      {
        key: readFileSync(join(__dirname, "../../sources/fixtures/key.pem")),
        cert: readFileSync(join(__dirname, "../../sources/fixtures/cert.pem")),
      },
      (req, res) => {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "X-Foo": "bar",
        });
        res.end("{}");
      }
    );
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const dispatcher = new Agent({
      allowH2: true,
      connect: { rejectUnauthorized: false },
    });
    t.teardown(async () => {
      await dispatcher.close();
      server.close();
    });

    let headers: Record<string, string | string[]> | undefined;
    const onHeaders = (message: unknown) => {
      headers = parseHeaders(
        (
          message as {
            response: { headers: Parameters<typeof parseHeaders>[0] };
          }
        ).response.headers
      );
    };
    dc.subscribe("undici:request:headers", onHeaders);
    t.teardown(() => dc.unsubscribe("undici:request:headers", onHeaders));

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`https://127.0.0.1:${port}/`, { dispatcher });
    await response.text();

    t.match(headers, {
      "content-type": "application/json",
      "x-foo": "bar",
    });
  }
);

t.test("it is not affected by prototype pollution header names", async (t) => {
  const fromArray = parseHeaders([
    "__proto__",
    "a",
    "__proto__",
    "b",
    "constructor",
    "c",
    "constructor",
    "d",
    "content-type",
    "application/json",
  ]);
  t.same(fromArray["content-type"], "application/json");
  // oxlint-disable-next-line no-proto
  t.same(fromArray["__proto__"], ["a", "b"]);
  t.same(fromArray["constructor"], ["c", "d"]);
  t.equal(Object.getPrototypeOf(fromArray), null);

  const fromObject = parseHeaders({
    ["__proto__"]: ["a", "b"],
    constructor: "c",
    "Content-Type": "application/json",
  });
  t.same(fromObject["content-type"], "application/json");
  t.equal(Object.getPrototypeOf(fromObject), null);
  t.equal(({} as Record<string, unknown>).a, undefined);
  t.equal(Object.getPrototypeOf({}), Object.prototype);
});
