import * as t from "tap";
import { Context } from "../agent/Context";
import { ServiceConfig } from "../agent/ServiceConfig";
import { matchEndpoint } from "./matchEndpoint";

const context: Context = {
  remoteAddress: "::1",
  method: "POST",
  url: "http://localhost:4000/posts/3",
  query: {},
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/posts/:id",
};

t.test("invalid URL and no route", async () => {
  t.same(
    matchEndpoint(
      { ...context, route: undefined, url: "abc" },
      new ServiceConfig([], 0, [], [])
    ),
    undefined
  );
});

t.test("no URL and no route", async () => {
  t.same(
    matchEndpoint(
      { ...context, route: undefined, url: undefined },
      new ServiceConfig([], 0, [], [])
    ),
    undefined
  );
});

t.test("no method", async () => {
  t.same(
    matchEndpoint(
      { ...context, method: undefined },
      new ServiceConfig([], 0, [], [])
    ),
    undefined
  );
});

t.test("it returns undefined if nothing found", async () => {
  t.same(matchEndpoint(context, new ServiceConfig([], 0, [], [])), undefined);
});

t.test("it returns endpoint based on route", async () => {
  const config = new ServiceConfig(
    [
      {
        method: "POST",
        route: "/posts/:id",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
    ],
    0,
    [],
    []
  );

  t.same(matchEndpoint(context, config), {
    endpoint: {
      method: "POST",
      route: "/posts/:id",
      rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
      forceProtectionOff: false,
    },
    route: "/posts/:id",
  });
});

t.test("it returns endpoint based on url", async () => {
  const config = new ServiceConfig(
    [
      {
        method: "POST",
        route: "/posts/3",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
    ],
    0,
    [],
    []
  );

  t.same(matchEndpoint({ ...context, route: undefined }, config), {
    endpoint: {
      method: "POST",
      route: "/posts/3",
      rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
      forceProtectionOff: false,
    },
    route: "/posts/3",
  });
});

t.test("it returns endpoint based on wildcard", async () => {
  const config = new ServiceConfig(
    [
      {
        method: "*",
        route: "/posts/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
    ],
    0,
    [],
    []
  );

  t.same(matchEndpoint({ ...context, route: undefined }, config), {
    endpoint: {
      method: "*",
      route: "/posts/*",
      rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
      forceProtectionOff: false,
    },
    route: "/posts/*",
  });
});

t.test("it favors more specific wildcard", async () => {
  const config = new ServiceConfig(
    [
      {
        method: "*",
        route: "/posts/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
      {
        method: "*",
        route: "/posts/*/comments/*",
        rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
        forceProtectionOff: false,
      },
    ],
    0,
    [],
    []
  );

  t.same(
    matchEndpoint(
      {
        ...context,
        url: "http://localhost:4000/posts/3/comments/10",
        route: undefined,
      },
      config
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
