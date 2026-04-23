import { ReportingAPIForTesting } from "../agent/api/ReportingAPIForTesting";
import { startTestAgent } from "../helpers/startTestAgent";
import { LoopBack } from "./LoopBack";
import * as t from "tap";
import { getContext, runWithContext, type Context } from "../agent/Context";

startTestAgent({
  api: new ReportingAPIForTesting(),
  wrappers: [new LoopBack()],
  rewrite: {},
});

function buildContext(): Context {
  return {
    body: undefined,
    url: "/",
    method: "POST",
    query: {},
    headers: {},
    routeParams: {},
    remoteAddress: "127.0.0.1",
    cookies: {},
    source: "express",
    route: "/",
  };
}

t.test("it sets the body in context when parsing succeeds", async (t) => {
  const { RequestBodyParser } = require("@loopback/rest");

  const parser = new RequestBodyParser(undefined, undefined);

  const mockRequest = {
    get: (header: string) =>
      header === "content-type" ? "application/json" : undefined,
  };

  const operationSpec = {
    requestBody: {
      content: {
        "application/json": {
          schema: { type: "object" },
          "x-parser": async () => ({ value: { foo: "bar" } }),
        },
      },
    },
  };

  await runWithContext(buildContext(), async () => {
    await parser.loadRequestBodyIfNeeded(operationSpec, mockRequest);
    t.same(getContext()?.body, { foo: "bar" });
  });
});

t.test("it does not set body when value is empty", async (t) => {
  const { RequestBodyParser } = require("@loopback/rest");

  const parser = new RequestBodyParser(undefined, undefined);

  const mockRequest = {
    get: (header: string) =>
      header === "content-type" ? "application/json" : undefined,
  };

  const operationSpec = {
    requestBody: {
      content: {
        "application/json": {
          schema: { type: "object" },
          "x-parser": async () => ({ value: null }),
        },
      },
    },
  };

  await runWithContext(buildContext(), async () => {
    await parser.loadRequestBodyIfNeeded(operationSpec, mockRequest);
    t.equal(getContext()?.body, undefined);
  });
});

t.test("it does not set body when no context is active", async (t) => {
  const { RequestBodyParser } = require("@loopback/rest");

  const parser = new RequestBodyParser(undefined, undefined);

  const mockRequest = {
    get: (header: string) =>
      header === "content-type" ? "application/json" : undefined,
  };

  const operationSpec = {
    requestBody: {
      content: {
        "application/json": {
          schema: { type: "object" },
          "x-parser": async () => ({ value: { foo: "bar" } }),
        },
      },
    },
  };

  await parser.loadRequestBodyIfNeeded(operationSpec, mockRequest);
  t.equal(getContext(), undefined);
});

t.test("it does not modify non-promise return values", async (t) => {
  const { RequestBodyParser } = require("@loopback/rest");

  const parser = new RequestBodyParser(undefined, undefined);

  const mockRequest = {
    get: (_header: string) => undefined,
  };

  const operationSpec = { requestBody: undefined };

  const result = await runWithContext(buildContext(), async () => {
    return parser.loadRequestBodyIfNeeded(operationSpec, mockRequest);
  });

  t.equal(getContext(), undefined);
  t.match(result, { value: undefined });
});

t.test("it sets route params in context when parseOperationArgs is called", async (t) => {
  const { parseOperationArgs } = require("@loopback/rest");

  const mockRequest = {
    get: (_header: string) => undefined,
    query: {},
    headers: {},
  };

  const mockRoute = {
    pathParams: { username: "alice" },
    spec: { parameters: [] },
    schemas: {},
    describe: () => "GET /insecure-sql/{username}",
  };

  await runWithContext(buildContext(), async () => {
    await parseOperationArgs(mockRequest, mockRoute);
    t.same(getContext()?.routeParams, { username: "alice" });
  });
});

t.test("it does not set route params when no context is active", async (t) => {
  const { parseOperationArgs } = require("@loopback/rest");

  const mockRequest = {
    get: (_header: string) => undefined,
    query: {},
    headers: {},
  };

  const mockRoute = {
    pathParams: { username: "alice" },
    spec: { parameters: [] },
    schemas: {},
    describe: () => "GET /insecure-sql/{username}",
  };

  // Should not throw even without an active context
  await parseOperationArgs(mockRequest, mockRoute);
  t.equal(getContext(), undefined);
});

t.test("it does not set route params when pathParams is missing", async (t) => {
  const { parseOperationArgs } = require("@loopback/rest");

  const mockRequest = {
    get: (_header: string) => undefined,
    query: {},
    headers: {},
  };

  const mockRoute = {
    spec: { parameters: [] },
    schemas: {},
    describe: () => "GET /ping",
  };

  await runWithContext(buildContext(), async () => {
    await parseOperationArgs(mockRequest, mockRoute);
    t.same(getContext()?.routeParams, {});
  });
});
