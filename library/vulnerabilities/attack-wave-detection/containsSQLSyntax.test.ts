import * as t from "tap";
import { containsSQLSyntax } from "./containsSQLSyntax";
import type { Context } from "../../agent/Context";

function getTestContext(path: string, query: string): Context {
  return {
    remoteAddress: "::1",
    method: "GET",
    url: `http://localhost:4000${path}`,
    query: {
      test: query,
      utmSource: "newsletter",
      utmMedium: "electronicmail",
      utmCampaign: "test",
      utmTerm: "sql_injection",
    },
    headers: {
      "content-type": "application/json",
    },
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: path,
  };
}

t.test("it detects SQL injection patterns", async (t) => {
  const testStrings = [
    "' or '1'='1",
    "1: SELECT * FROM users WHERE '1'='1'",
    "', information_schema.tables",
    "1' sleep(5)",
    "WAITFOR DELAY 1",
  ];

  for (const str of testStrings) {
    t.ok(
      containsSQLSyntax(getTestContext(`/test`, str)),
      `Expected ${str} to match SQL injection patterns`
    );
  }
});

t.test("it does not detect", async (t) => {
  const nonMatchingPaths = [
    "/",
    "/api/user",
    "/blog/a+blog+article",
    "/products/1",
    "/search?q=normal+search+term",
    "/user/profile",
    "/orders/1",
    "/static/somefile.s1f56e.css",
    "/favicon.ico",
    "/img/mysql.svg",
    "/get/test",
    "/.well-known/security.txt",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.json",
    "/prototype/test.txt",
    "/test?data=test&data2=test2",
  ];

  for (const str of nonMatchingPaths) {
    t.notOk(
      containsSQLSyntax(getTestContext(str, "")),
      `Expected ${str} to NOT match SQL injection patterns`
    );
  }
});

t.test("it handles empty query object", async (t) => {
  const contextWithEmptyQuery: Context = {
    remoteAddress: "::1",
    method: "GET",
    url: "http://localhost:4000/test",
    query: {},
    headers: {
      "content-type": "application/json",
    },
    body: {},
    cookies: {},
    routeParams: {},
    source: "express",
    route: "/test",
  };

  t.notOk(
    containsSQLSyntax(contextWithEmptyQuery),
    "Expected empty query to NOT match SQL injection patterns"
  );
});
