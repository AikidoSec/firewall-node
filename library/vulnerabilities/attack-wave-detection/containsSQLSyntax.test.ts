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
    "2; DROP TABLE users",
    "1 OR 1=1",
    "' WHERE 1=1",
    "' or '1'='1",
    "2; DELETE FROM users",
    "1: SELECT * FROM users WHERE '1'='1'",
    "', information_schema.tables",
    "1 UNION SELECT username, password FROM users",
    "1' sleep(5)",
  ];

  for (const str of testStrings) {
    t.ok(
      containsSQLSyntax(getTestContext(`/test`, str)),
      `Expected ${str} to match SQL injection patterns`
    );
    t.ok(
      containsSQLSyntax(getTestContext(`/api/user/${str}`, "")),
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
