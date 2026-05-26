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
  t.ok(isWebScanner(getTestContext("/wp-config.php", "GET"), 200));
  t.ok(isWebScanner(getTestContext("/.env", "GET"), 200));
  t.ok(isWebScanner(getTestContext("/test/.env.bak", "GET"), 200));
  t.ok(isWebScanner(getTestContext("/.git/config", "GET"), 200));
  t.ok(isWebScanner(getTestContext("/.aws/config", "GET"), 200));
  t.ok(isWebScanner(getTestContext("/../secret", "GET"), 200));
  t.ok(isWebScanner(getTestContext("/", "BADMETHOD"), 200));
  t.ok(
    isWebScanner(
      getTestContext("/", "GET", { test: "SELECT * FROM admin" }),
      200
    )
  );
  t.ok(
    isWebScanner(getTestContext("/", "GET", { test: "../etc/passwd" }), 200)
  );
});

t.test("is not a web scanner", async (t) => {
  t.notOk(isWebScanner(getTestContext("graphql", "POST"), 200));
  t.notOk(isWebScanner(getTestContext("/api/v1/users", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/public/index.html", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/static/js/app.js", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/uploads/image.png", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/", "GET", { test: "1'" }), 200));
  t.notOk(isWebScanner(getTestContext("/", "GET", { test: "abcd" }), 200));
});

t.test("foreign extension with 404 is a scan", async (t) => {
  t.ok(isWebScanner(getTestContext("/admin.php", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/login.php3", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/test.php4", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/old.php5", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/page.phtml", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/App.java", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/app.jsp", "GET"), 404));
  t.ok(isWebScanner(getTestContext("/app.jspx", "GET"), 404));
});

t.test("foreign extension with 200 is not a scan", async (t) => {
  t.notOk(isWebScanner(getTestContext("/admin.php", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/login.php3", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/app.jsp", "GET"), 200));
  t.notOk(isWebScanner(getTestContext("/App.java", "GET"), 200));
});

t.test("foreign extension with other status codes is not a scan", async (t) => {
  t.notOk(isWebScanner(getTestContext("/admin.php", "GET"), 301));
  t.notOk(isWebScanner(getTestContext("/admin.php", "GET"), 403));
  t.notOk(isWebScanner(getTestContext("/admin.php", "GET"), 500));
});
