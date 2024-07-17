import * as t from "tap";
import { Context } from "../agent/Context";
import { buildRouteFromURL } from "./buildRouteFromURL";
import { matchEndpoint } from "./matchEndpoint";

const url = "http://localhost:4000/posts/3";
const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: url,
  query: {},
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: buildRouteFromURL(url),
};

t.test("invalid URL and no route", async () => {
  t.same(
    matchEndpoint({ ...context, route: undefined, url: "abc" }, [], () => true),
    undefined
  );
});

t.test("no URL and no route", async () => {
  t.same(
    matchEndpoint(
      { ...context, route: undefined, url: undefined },
      [],
      () => true
    ),
    undefined
  );
});

t.test("no method", async () => {
  t.same(
    matchEndpoint({ ...context, method: undefined }, [], () => true),
    undefined
  );
});

t.test("it returns undefined if nothing found", async () => {
  t.same(
    matchEndpoint(context, [], () => true),
    undefined
  );
});

t.test("it returns endpoint based on route", async () => {
  t.same(
    matchEndpoint(
      context,
      [
        {
          method: "POST",
          route: "/posts/:number",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "POST",
        route: "/posts/:number",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      route: "/posts/:number",
    }
  );
});

t.test("it returns endpoint based on relative url", async () => {
  t.same(
    matchEndpoint(
      { ...context, route: buildRouteFromURL("/posts/3"), url: "/posts/3" },
      [
        {
          method: "POST",
          route: "/posts/:number",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "POST",
        route: "/posts/:number",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      route: "/posts/:number",
    }
  );
});

t.test("it returns endpoint based on wildcard", async () => {
  t.same(
    matchEndpoint(
      { ...context, route: undefined },
      [
        {
          method: "*",
          route: "/posts/*",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "*",
        route: "/posts/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      route: "/posts/*",
    }
  );
});

t.test("it returns endpoint based on wildcard with relative URL", async () => {
  t.same(
    matchEndpoint(
      { ...context, route: undefined, url: "/posts/3" },
      [
        {
          method: "*",
          route: "/posts/*",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "*",
        route: "/posts/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      route: "/posts/*",
    }
  );
});

t.test("it favors more specific wildcard", async () => {
  t.same(
    matchEndpoint(
      {
        ...context,
        url: "http://localhost:4000/posts/3/comments/10",
        route: undefined,
      },
      [
        {
          method: "*",
          route: "/posts/*",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
        {
          method: "*",
          route: "/posts/*/comments/*",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "*",
        route: "/posts/*/comments/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      route: "/posts/*/comments/*",
    }
  );
});

t.test("it matches wildcard route with specific method", async () => {
  t.same(
    matchEndpoint(
      {
        ...context,
        url: "http://localhost:4000/posts/3/comments/10",
        route: undefined,
        method: "POST",
      },
      [
        {
          method: "POST",
          route: "/posts/*/comments/*",
          rateLimiting: {
            enabled: true,
            maxRequests: 10,
            windowSizeInMS: 1000,
          },
          forceProtectionOff: false,
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "POST",
        route: "/posts/*/comments/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      route: "/posts/*/comments/*",
    }
  );
});

t.test("it prefers specific route over wildcard", async () => {
  t.same(
    matchEndpoint(
      {
        ...context,
        route: "/api/coach",
        method: "POST",
        url: "http://localhost:4000/api/coach",
      },
      [
        {
          method: "*",
          route: "/api/*",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 20,
            windowSizeInMS: 60000,
          },
        },
        {
          method: "POST",
          route: "/api/coach",
          forceProtectionOff: false,
          rateLimiting: {
            enabled: true,
            maxRequests: 100,
            windowSizeInMS: 60000,
          },
        },
      ],
      () => true
    ),
    {
      endpoint: {
        method: "POST",
        route: "/api/coach",
        forceProtectionOff: false,
        rateLimiting: {
          enabled: true,
          maxRequests: 100,
          windowSizeInMS: 60000,
        },
      },
      route: "/api/coach",
    }
  );
});
