import * as t from "tap";
import { isWebScanPath } from "./isWebScanPath";

t.test("isWebScanPath", async (t) => {
  t.ok(isWebScanPath("/.env"));
  t.ok(isWebScanPath("/test/.env"));
  t.ok(isWebScanPath("/test/.env.bak"));
  t.ok(isWebScanPath("/.git/config"));
  t.ok(isWebScanPath("/.aws/config"));
  t.ok(isWebScanPath("/some/path/.git/test"));
  t.ok(isWebScanPath("/some/path/.gitlab-ci.yml"));
});

t.test("is not a web scan path", async (t) => {
  t.notOk(isWebScanPath("/test/file.txt"));
  t.notOk(isWebScanPath("/some/route/to/file.txt"));
  t.notOk(isWebScanPath("/some/route/to/file.json"));
  t.notOk(isWebScanPath("/en"));
  t.notOk(isWebScanPath("/"));
});
