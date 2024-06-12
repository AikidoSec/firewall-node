import * as t from "tap";
import { shouldDiscoverRoute } from "./shouldDiscoverRoute";

t.test(
  "it does not discover route if not found or method not allowed",
  async () => {
    t.same(
      shouldDiscoverRoute({ statusCode: 404, route: "/", method: "GET" }),
      false
    );
    t.same(
      shouldDiscoverRoute({ statusCode: 405, route: "/", method: "GET" }),
      false
    );
  }
);

t.test("it discovers route for all other status codes", async () => {
  t.same(
    shouldDiscoverRoute({ statusCode: 200, route: "/", method: "GET" }),
    true
  );
  t.same(
    shouldDiscoverRoute({ statusCode: 500, route: "/", method: "GET" }),
    true
  );
  t.same(
    shouldDiscoverRoute({ statusCode: 400, route: "/", method: "GET" }),
    true
  );
  t.same(
    shouldDiscoverRoute({ statusCode: 300, route: "/", method: "GET" }),
    true
  );
  t.same(
    shouldDiscoverRoute({ statusCode: 201, route: "/", method: "GET" }),
    true
  );
});

t.test("it does not discover route for OPTIONS or HEAD methods", async () => {
  t.same(
    shouldDiscoverRoute({ statusCode: 200, route: "/", method: "OPTIONS" }),
    false
  );
  t.same(
    shouldDiscoverRoute({ statusCode: 200, route: "/", method: "HEAD" }),
    false
  );
});

t.test(
  "it does not discover route for OPTIONS or HEAD methods even with other status codes",
  async () => {
    t.same(
      shouldDiscoverRoute({ statusCode: 404, route: "/", method: "OPTIONS" }),
      false
    );
    t.same(
      shouldDiscoverRoute({ statusCode: 405, route: "/", method: "HEAD" }),
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
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/precache-manifest.10faec0bee24db502c8498078126dd53.js",
      method: "POST",
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/img/icons/favicon-16x16.png",
      method: "GET",
    }),
    false
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/fonts/icomoon.ttf",
      method: "GET",
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
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/about.html",
      method: "GET",
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/contact.html",
      method: "GET",
    }),
    true
  );
});

t.test("it allows files with extension of one character", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/a.a",
      method: "GET",
    }),
    true
  );
});

t.test("it allows files with extension of 5 or more characters", async () => {
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/a.aaaaa",
      method: "GET",
    }),
    true
  );
  t.same(
    shouldDiscoverRoute({
      statusCode: 200,
      route: "/a.aaaaaa",
      method: "GET",
    }),
    true
  );
});
