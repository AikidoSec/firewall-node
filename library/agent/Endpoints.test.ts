import * as t from "tap";
import { Endpoints } from "./Endpoints";

t.test("it returns undefined when no context", async () => {
  const endpoints = new Endpoints([]);

  t.same(
    endpoints.fromContext({
      url: undefined,
      method: undefined,
      route: undefined,
    }),
    undefined
  );

  t.same(
    endpoints.fromContext({
      url: undefined,
      method: undefined,
      route: undefined,
    }),
    undefined
  );
});

t.test("it returns undefined when no route or url", async () => {
  const endpoints = new Endpoints([]);

  t.same(
    endpoints.fromContext({
      url: undefined,
      method: "GET",
      route: undefined,
    }),
    undefined
  );

  t.same(
    endpoints.fromContext({
      url: undefined,
      method: "GET",
      route: undefined,
    }),
    undefined
  );
});

t.test("it returns endpoint based on route", async () => {
  const endpoints = new Endpoints([
    {
      method: "POST",
      route: "/posts/:id",
      rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
      forceProtectionOff: false,
    },
  ]);

  const wanted = {
    endpoint: {
      method: "POST",
      route: "/posts/:id",
      rateLimiting: { enabled: true, maxRequests: 10, windowSizeInMS: 1000 },
      forceProtectionOff: false,
    },
    route: "/posts/:id",
  };

  t.same(
    endpoints.fromContext({
      url: undefined,
      method: "POST",
      route: "/posts/:id",
    }),
    wanted
  );

  t.same(
    endpoints.fromContext({
      url: undefined,
      method: "POST",
      route: "/posts/:id",
    }),
    wanted
  );
});
