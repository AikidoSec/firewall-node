import * as t from "tap";
import { sqlPathRegex } from "./sqlPathRegex";

t.test("it detects SQL injection patterns", async (t) => {
  const testPaths = [
    "/user/2; DROP TABLE users",
    "/admin/1 OR 1=1",
    "/search?q=' WHERE 1=1",
    "/user/admin' or '1'='1",
    "/user/2; DELETE FROM users",
    "/users/1: SELECT * FROM users WHERE '1'='1'",
    "/user/name', information_schema.tables",
    "/data?id=1 UNION SELECT username, password FROM users",
    "/data?id=1' sleep(5)",
  ];

  for (const path of testPaths) {
    t.ok(
      sqlPathRegex.test(path),
      `Expected ${path} to match SQL injection patterns`
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

  for (const path of nonMatchingPaths) {
    t.notOk(
      sqlPathRegex.test(path),
      `Expected ${path} to NOT match SQL injection patterns`
    );
  }
});
