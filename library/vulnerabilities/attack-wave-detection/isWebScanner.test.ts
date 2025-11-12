import * as t from "tap";
import { isWebScanner } from "./isWebScanner";
import { type Context } from "../../agent/Context";

function getTestContext(path: string, method: string, query = {}): Context {
  return {
    remoteAddress: "::1",
    method: method,
    url: `http://localhost:4000${path}`,
    query: query,
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

t.test("is a web scanner", async (t) => {
  t.ok(isWebScanner(getTestContext("/wp-config.php", "GET")));
  t.ok(isWebScanner(getTestContext("/.env", "GET")));
  t.ok(isWebScanner(getTestContext("/test/.env.bak", "GET")));
  t.ok(isWebScanner(getTestContext("/.git/config", "GET")));
  t.ok(isWebScanner(getTestContext("/.aws/config", "GET")));
  t.ok(isWebScanner(getTestContext("/../secret", "GET")));
  t.ok(isWebScanner(getTestContext("/", "BADMETHOD")));
  t.ok(
    isWebScanner(getTestContext("/", "GET", { test: "SELECT * FROM admin" }))
  );
  t.ok(isWebScanner(getTestContext("/", "GET", { test: "../etc/passwd" })));
});

t.test("is not a web scanner", async (t) => {
  t.notOk(isWebScanner(getTestContext("graphql", "POST")));
  t.notOk(isWebScanner(getTestContext("/api/v1/users", "GET")));
  t.notOk(isWebScanner(getTestContext("/public/index.html", "GET")));
  t.notOk(isWebScanner(getTestContext("/static/js/app.js", "GET")));
  t.notOk(isWebScanner(getTestContext("/uploads/image.png", "GET")));
  t.notOk(isWebScanner(getTestContext("/", "GET", { test: "1'" })));
  t.notOk(isWebScanner(getTestContext("/", "GET", { test: "abcd" })));
});
