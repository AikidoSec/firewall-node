import * as t from "tap";
import type { Context } from "../agent/Context";
import { ServiceConfig } from "../agent/ServiceConfig";
import { getRateLimitedEndpoint } from "./getRateLimitedEndpoint";

const getContext = (): Context => ({
  remoteAddress: "1.2.3.4",
  method: "POST",
  url: "https://acme.com/api/login",
  query: {},
  headers: {},
  body: undefined,
  cookies: {},
  routeParams: {},
  source: "express",
  route: "/api/login",
});

t.test("it returns undefined if no endpoints", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig([], 0, [], [], true, [], [])
    ),
    undefined
  );
});

t.test("it returns undefined if no matching endpoints", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig(
        [
          {
            method: "GET",
            route: "/",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: false,
              maxRequests: 3,
              windowSizeInMS: 1000,
            },
          },
        ],
        0,
        [],
        [],
        false,
        [],
        []
      )
    ),
    undefined
  );
});

t.test("it returns undefined if matching but not enabled", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig(
        [
          {
            method: "POST",
            route: "/api/login",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: false,
              maxRequests: 3,
              windowSizeInMS: 1000,
            },
          },
        ],
        0,
        [],
        [],
        false,
        [],
        []
      )
    ),
    undefined
  );
});

t.test("it returns endpoint if matching and enabled", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig(
        [
          {
            method: "POST",
            route: "/api/login",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 3,
              windowSizeInMS: 1000,
            },
          },
        ],
        0,
        [],
        [],
        false,
        [],
        []
      )
    ),
    {
      method: "POST",
      route: "/api/login",
      forceProtectionOff: false,
      allowedIPAddresses: undefined,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 1000,
      },
    }
  );
});

t.test("it returns endpoint with lowest max requests", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig(
        [
          {
            method: "POST",
            route: "/api/log*",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 3,
              windowSizeInMS: 1000,
            },
          },
          {
            method: "POST",
            route: "/api/*",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 1,
              windowSizeInMS: 1000,
            },
          },
        ],
        0,
        [],
        [],
        false,
        [],
        []
      )
    ),
    {
      method: "POST",
      route: "/api/*",
      forceProtectionOff: false,
      allowedIPAddresses: undefined,
      rateLimiting: {
        enabled: true,
        maxRequests: 1,
        windowSizeInMS: 1000,
      },
    }
  );
});

t.test("it returns endpoint with smallest window size", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig(
        [
          {
            method: "POST",
            route: "/api/*",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 3,
              windowSizeInMS: 1000,
            },
          },
          {
            method: "POST",
            route: "/api/log*",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 3,
              windowSizeInMS: 5000,
            },
          },
        ],
        0,
        [],
        [],
        false,
        [],
        []
      )
    ),
    {
      method: "POST",
      route: "/api/log*",
      forceProtectionOff: false,
      allowedIPAddresses: undefined,
      rateLimiting: {
        enabled: true,
        maxRequests: 3,
        windowSizeInMS: 5000,
      },
    }
  );
});

t.test("it always returns exact matches first", async () => {
  t.same(
    getRateLimitedEndpoint(
      getContext(),
      new ServiceConfig(
        [
          {
            method: "POST",
            route: "/api/login",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 10,
              windowSizeInMS: 5000,
            },
          },
          {
            method: "POST",
            route: "/api/*",
            forceProtectionOff: false,
            allowedIPAddresses: [],
            rateLimiting: {
              enabled: true,
              maxRequests: 3,
              windowSizeInMS: 5000,
            },
          },
        ],
        0,
        [],
        [],
        false,
        [],
        []
      )
    ),
    {
      method: "POST",
      route: "/api/login",
      forceProtectionOff: false,
      allowedIPAddresses: undefined,
      rateLimiting: {
        enabled: true,
        maxRequests: 10,
        windowSizeInMS: 5000,
      },
    }
  );
});
