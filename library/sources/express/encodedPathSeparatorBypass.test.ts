import * as t from "tap";
import { ReportingAPIForTesting } from "../../agent/api/ReportingAPIForTesting";
import { Token } from "../../agent/api/Token";
import { startTestAgent } from "../../helpers/startTestAgent";
import { Express } from "../Express";
import { HTTPServer } from "../HTTPServer";
import * as request from "supertest";
import * as cookieParser from "cookie-parser";
import { getContext } from "../../agent/Context";
import { addExpressMiddleware } from "../../middleware/express";
import { isEsmUnitTest } from "../../helpers/isEsmUnitTest";

/**
 * Security test: Encoded path separators bypass Express endpoint-scoped access controls and rate limits
 * 
 * This test verifies that encoded path separators (e.g., %2F) do not bypass:
 * 1. Endpoint-specific IP allowlists
 * 2. Endpoint-specific rate limits
 * 
 * The vulnerability occurred because buildRouteFromURL decoded the entire pathname before splitting,
 * causing /posts/a%2Fb to become /posts/a/b, which would not match the configured /posts/:id route.
 * This caused endpoint-specific security controls to be bypassed.
 */

// Before require("express")
const agent = startTestAgent({
  api: new ReportingAPIForTesting({
    success: true,
    endpoints: [
      {
        method: "GET",
        route: "/posts/:id",
        forceProtectionOff: false,
        allowedIPAddresses: ["1.2.3.4"],
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 2,
          enabled: true,
        },
      },
      {
        method: "GET",
        route: "/api/users/:userId",
        forceProtectionOff: false,
        allowedIPAddresses: ["5.6.7.8"],
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 1,
          enabled: true,
        },
      },
      {
        method: "POST",
        route: "/admin/:action",
        forceProtectionOff: false,
        allowedIPAddresses: ["10.0.0.1"],
        rateLimiting: {
          windowSizeInMS: 2000,
          maxRequests: 1,
          enabled: true,
        },
      },
    ],
    blockedUserIds: [],
    configUpdatedAt: 0,
    heartbeatIntervalInMS: 10 * 60 * 1000,
    allowedIPAddresses: [],
    excludedUserIdsFromRateLimiting: [],
  }),
  token: new Token("123"),
  wrappers: [new Express(), new HTTPServer()],
  rewrite: {
    express: "express-v4",
  },
});

let express = require("express-v4") as typeof import("express");

if (isEsmUnitTest()) {
  // @ts-expect-error Wrong types
  express = express.default;
}

function getApp() {
  const app = express();

  app.set("trust proxy", true);
  app.set("env", "production"); // Set to production to enable IP allowlist checks

  app.use(cookieParser());
  addExpressMiddleware(app);

  app.get("/posts/:id", (req, res) => {
    res.send({
      route: getContext()?.route,
      params: req.params,
      success: true,
    });
  });

  app.get("/api/users/:userId", (req, res) => {
    res.send({
      route: getContext()?.route,
      params: req.params,
      success: true,
    });
  });

  app.post("/admin/:action", (req, res) => {
    res.send({
      route: getContext()?.route,
      params: req.params,
      success: true,
    });
  });

  return app;
}

t.test(
  "encoded slash in path segment should not bypass IP allowlist",
  async (t) => {
    // Test 1: Normal request from allowed IP should succeed
    const normalResponse = await request(getApp())
      .get("/posts/123")
      .set("X-Forwarded-For", "1.2.3.4");

    t.equal(normalResponse.statusCode, 200, "Normal request should succeed");
    t.match(
      normalResponse.body,
      { route: "/posts/:number", success: true },
      "Normal request should match /posts/:id route"
    );

    // Test 2: Normal request from disallowed IP should be blocked
    const blockedResponse = await request(getApp())
      .get("/posts/123")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      blockedResponse.statusCode,
      403,
      "Request from disallowed IP should be blocked"
    );
    t.match(
      blockedResponse.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message"
    );

    // Test 3: Request with encoded slash from disallowed IP should also be blocked
    // This is the security fix: /posts/a%2Fb should still match /posts/:id
    const encodedSlashResponse = await request(getApp())
      .get("/posts/a%2Fb")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      encodedSlashResponse.statusCode,
      403,
      "Request with encoded slash from disallowed IP should be blocked"
    );
    t.match(
      encodedSlashResponse.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message for encoded slash"
    );

    // Test 4: Request with encoded slash from allowed IP should succeed
    const encodedSlashAllowedResponse = await request(getApp())
      .get("/posts/a%2Fb")
      .set("X-Forwarded-For", "1.2.3.4");

    t.equal(
      encodedSlashAllowedResponse.statusCode,
      200,
      "Request with encoded slash from allowed IP should succeed"
    );
    t.match(
      encodedSlashAllowedResponse.body,
      { success: true },
      "Should successfully process request with encoded slash from allowed IP"
    );
  }
);

t.test(
  "encoded slash in path segment should not bypass rate limiting",
  async (t) => {
    // Test 1: Normal requests should be rate limited after maxRequests
    const response1 = await request(getApp())
      .get("/api/users/123")
      .set("X-Forwarded-For", "5.6.7.8");

    t.equal(response1.statusCode, 200, "First request should succeed");

    const response2 = await request(getApp())
      .get("/api/users/456")
      .set("X-Forwarded-For", "5.6.7.8");

    t.equal(
      response2.statusCode,
      429,
      "Second request should be rate limited (maxRequests=1)"
    );
    t.match(
      response2.text,
      /rate limit/i,
      "Should return rate limit message"
    );

    // Wait for rate limit window to reset
    await new Promise((resolve) => setTimeout(resolve, 2100));

    // Test 2: Request with encoded slash should also be rate limited
    const encodedResponse1 = await request(getApp())
      .get("/api/users/a%2Fb")
      .set("X-Forwarded-For", "5.6.7.8");

    t.equal(
      encodedResponse1.statusCode,
      200,
      "First request with encoded slash should succeed"
    );

    const encodedResponse2 = await request(getApp())
      .get("/api/users/c%2Fd")
      .set("X-Forwarded-For", "5.6.7.8");

    t.equal(
      encodedResponse2.statusCode,
      429,
      "Second request with encoded slash should be rate limited"
    );
    t.match(
      encodedResponse2.text,
      /rate limit/i,
      "Should return rate limit message for encoded slash"
    );
  }
);

t.test(
  "double-encoded slash should also not bypass security controls",
  async (t) => {
    // %252F decodes to %2F, which should still be treated as an encoded slash
    const response = await request(getApp())
      .get("/posts/a%252Fb")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      response.statusCode,
      403,
      "Request with double-encoded slash from disallowed IP should be blocked"
    );
    t.match(
      response.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message for double-encoded slash"
    );
  }
);

t.test(
  "encoded backslash should also not bypass security controls",
  async (t) => {
    // %5C is an encoded backslash, which could also be used for path traversal
    const response = await request(getApp())
      .get("/posts/a%5Cb")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      response.statusCode,
      403,
      "Request with encoded backslash from disallowed IP should be blocked"
    );
    t.match(
      response.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message for encoded backslash"
    );
  }
);

t.test(
  "multiple encoded slashes in one segment should not bypass security controls",
  async (t) => {
    const response = await request(getApp())
      .get("/posts/a%2Fb%2Fc")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      response.statusCode,
      403,
      "Request with multiple encoded slashes from disallowed IP should be blocked"
    );
    t.match(
      response.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message for multiple encoded slashes"
    );
  }
);

t.test(
  "combination of encoded slash and other encoded characters should not bypass security controls",
  async (t) => {
    // %20 is space, %2F is slash - both should be handled correctly
    const response = await request(getApp())
      .get("/posts/hello%20world%2Ftest")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      response.statusCode,
      403,
      "Request with mixed encoded characters from disallowed IP should be blocked"
    );
    t.match(
      response.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message for mixed encoded characters"
    );
  }
);

t.test(
  "POST request with encoded slash should not bypass security controls",
  async (t) => {
    // Test with POST method to ensure the fix works across different HTTP methods
    const response = await request(getApp())
      .post("/admin/delete%2Fuser")
      .set("X-Forwarded-For", "9.9.9.9");

    t.equal(
      response.statusCode,
      403,
      "POST request with encoded slash from disallowed IP should be blocked"
    );
    t.match(
      response.text,
      /not allowed to access this resource/,
      "Should return IP not allowed message for POST with encoded slash"
    );
  }
);

t.test(
  "route matching should work correctly with encoded slashes",
  async (t) => {
    // Verify that the route is correctly identified even with encoded slashes
    const response = await request(getApp())
      .get("/posts/test%2Fvalue")
      .set("X-Forwarded-For", "1.2.3.4");

    t.equal(response.statusCode, 200, "Request should succeed");
    
    // The route should still be identified as /posts/:id (or /posts/:number after parameterization)
    // The key is that it matches the configured endpoint, not that it creates a different route
    t.ok(
      response.body.route === "/posts/:number" || 
      response.body.route === "/posts/test%2Fvalue",
      "Route should be correctly identified"
    );
  }
);

t.test(
  "normal path separators should still work correctly",
  async (t) => {
    // Ensure that normal paths without encoded characters still work
    const response1 = await request(getApp())
      .get("/posts/123")
      .set("X-Forwarded-For", "1.2.3.4");

    t.equal(response1.statusCode, 200, "Normal path should work");
    t.match(response1.body, { success: true }, "Should process normally");

    const response2 = await request(getApp())
      .get("/api/users/john")
      .set("X-Forwarded-For", "5.6.7.8");

    t.equal(response2.statusCode, 200, "Normal path should work");
    t.match(response2.body, { success: true }, "Should process normally");
  }
);
