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
  for (let code = 200; code <= 299; code++) {
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

t.test("it does not discover internal GET redirects", async () => {
  const base = { method: "GET", route: "/blog", forceProtectionOff: false };

  for (const statusCode of [301, 302, 303, 307, 308]) {
    for (const redirectLocation of [
      "/login",
      "login",
      "?next=/home",
      ".",
      "..",
    ]) {
      t.same(
        shouldDiscoverRoute({ ...base, statusCode, redirectLocation }),
        false,
        redirectLocation
      );
    }
    t.same(
      shouldDiscoverRoute({
        ...base,
        statusCode,
        redirectLocation: "http://example.com//blog",
        host: "example.com",
        isBehindTrustedProxy: true,
      }),
      false
    );
  }
});

t.test(
  "it discovers external GET redirects and non-GET redirects",
  async () => {
    const base = { route: "/auth/google", forceProtectionOff: false };

    t.same(
      shouldDiscoverRoute({
        ...base,
        method: "GET",
        statusCode: 302,
        redirectLocation: "https://accounts.google.com/o/oauth2",
        host: "example.com",
        isBehindTrustedProxy: true,
      }),
      true
    );
    t.same(
      shouldDiscoverRoute({
        ...base,
        method: "GET",
        statusCode: 302,
        redirectLocation: "//evil.com/path",
        host: "example.com",
        isBehindTrustedProxy: true,
      }),
      true
    );
    t.same(
      shouldDiscoverRoute({
        ...base,
        method: "GET",
        statusCode: 302,
        redirectLocation: "http://example.com/auth/google",
        host: "example.com",
        isBehindTrustedProxy: false,
      }),
      true
    );
    t.same(
      shouldDiscoverRoute({ ...base, method: "GET", statusCode: 304 }),
      true
    );
    t.same(
      shouldDiscoverRoute({
        ...base,
        method: "POST",
        statusCode: 302,
        redirectLocation: "/dashboard",
      }),
      true
    );
  }
);

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
