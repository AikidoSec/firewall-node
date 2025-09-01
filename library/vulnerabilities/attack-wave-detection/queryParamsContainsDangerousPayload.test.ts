import * as t from "tap";
import { queryParamsContainsDangerousPayload } from "./queryParamsContainsDangerousPayload";
import type { Context } from "../../agent/Context";

function getTestContext(query: string): Context {
  return {
    remoteAddress: "::1",
    method: "GET",
    url: `http://localhost:4000/test`,
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
    route: "/test",
  };
}

t.test("it detects injection patterns", async (t) => {
  const testStrings = [
    "' or '1'='1",
    "1: SELECT * FROM users WHERE '1'='1'",
    "', information_schema.tables",
    "1' sleep(5)",
    "WAITFOR DELAY 1",
    "../etc/passwd",
  ];

  for (const str of testStrings) {
    t.ok(
      queryParamsContainsDangerousPayload(getTestContext(str)),
      `Expected ${str} to match patterns`
    );
  }
});

t.test("it does not detect", async (t) => {
  const nonMatchingQueryElements = ["google.de", "some-string", "1", ""];

  for (const str of nonMatchingQueryElements) {
    t.notOk(
      queryParamsContainsDangerousPayload(getTestContext(str)),
      `Expected ${str} to NOT match patterns`
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
    queryParamsContainsDangerousPayload(contextWithEmptyQuery),
    "Expected empty query to NOT match injection patterns"
  );
});
