import * as t from "tap";
import { shouldDiscoverRoute } from "./shouldDiscoverRoute";

t.test("it rejects invalid status codes", async () => {
  for (let code = 100; code <= 199; code++) {
    t.same(
      shouldDiscoverRoute({
        statusCode: code,
        route: "/",
        method: "GET",
        forceProtectionOff: false,
      }),
      false
    );
  }

  for (let code = 400; code <= 599; code++) {
    t.same(
      shouldDiscoverRoute({
        statusCode: code,
        route: "/",
        method: "GET",
        forceProtectionOff: false,
      }),
      false
    );
  }
});

t.test("it accepts valid status codes", async () => {
  for (let code = 200; code <= 399; code++) {
    t.same(
      shouldDiscoverRoute({
        statusCode: code,
        route: "/",
        method: "GET",
        forceProtectionOff: false,
      }),
      true
    );
  }
});

t.test("it does not discover route for OPTIONS or HEAD methods", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/",
      method: "OPTIONS",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/",
      method: "HEAD",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test(
  "it does not discover route for OPTIONS or HEAD methods even with other status codes",
  async () => {
    t.same(
      shouldDiscoverRoute({
        statusCode: 404,
        route: "/",
        method: "OPTIONS",
        forceProtectionOff: false,
      }),
      false
    );
    t.same(
      shouldDiscoverRoute({
        statusCode: 405,
        route: "/",
        method: "HEAD",
        forceProtectionOff: false,
      }),
      false
    );
  }
);

t.test("it does not discover static files", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/service-worker.js",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/precache-manifest.10faec0bee24db502c8498078126dd53.js",
      method: "POST",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/img/icons/favicon-16x16.png",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/fonts/icomoon.ttf",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it allows html files", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/index.html",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/contact.html",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it allows files with extension of one character", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/a.a",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
});

t.test("it allows files with extension of 6 or more characters", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/a.aaaaaa",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/a.aaaaaaa",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
});

t.test('it ignores files that end with ".properties"', async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/file.properties",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/directory/file.properties",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it ignores files or directories that start with dot", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/.env",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/.aws/credentials",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/directory/.gitconfig",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/hello/.gitignore/file",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it ignores files that end with php (used as directory", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/file.php",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/app_dev.php/_profiler/phpinfo",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it allows .well-known directory", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/.well-known",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/.well-known/change-password",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/.well-known/security.txt",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it ignores certain strings", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/cgi-bin/luci/;stok=/locale",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/whatever/cgi-bin",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it should ignore fonts", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/fonts/icomoon.ttf",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/fonts/icomoon.woff",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/fonts/icomoon.woff2",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it ignores files that end with .config", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/blog/App_Config/ConnectionStrings.config",
      method: "GET",
      forceProtectionOff: false,
    }),
    false
  );
});

t.test("it allows redirects", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 301,
      route: "/",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 302,
      route: "/",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 303,
      route: "/",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 307,
      route: "/",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 308,
      route: "/",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
});

t.test("it does not ignore normal routes", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/api/v1/users",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/api/v1/users/1",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 204,
      route: "/api/v1/users/1/friends",
      method: "POST",
      forceProtectionOff: false,
    }),
    true
  );
});

t.test("it does not discover routes with forceProtectionOff", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/api/v1/users",
      method: "GET",
      forceProtectionOff: true,
    }),
    false
  );
});

t.test("it discovers routes with forceProtectionOff set to false", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/api/v1/users",
      method: "GET",
      forceProtectionOff: false,
    }),
    true
  );
});
