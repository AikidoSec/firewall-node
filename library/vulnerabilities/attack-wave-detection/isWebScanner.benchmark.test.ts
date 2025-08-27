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

t.test("it does take less than 0.1ms", async (t) => {
  const start = performance.now();

  const iterations = 25_000;
  for (let i = 0; i < iterations; i++) {
    isWebScanner(getTestContext("/wp-config.php", "GET", { test: "1" }));
    isWebScanner(
      getTestContext("/vulnerable", "GET", { test: "1'; DROP TABLE users; --" })
    );
    isWebScanner(getTestContext("/", "GET", { test: "1" }));
  }

  const end = performance.now();

  const timePerCheck = (end - start) / iterations / 3;

  t.ok(timePerCheck < 0.1);
});
